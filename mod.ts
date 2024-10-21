import ollama, {
  type Options as OllamaOptions,
  type Tool as OllamaTool,
} from "npm:ollama@0.5.9";
import zod from "npm:zod@3.23.8";
import { zodToTs, printNode } from "npm:zod-to-ts@1.2.0";
import type { OjjsonAdapter } from "./adapter/adapter.ts";

export * from "./adapter/adapter.ts";
export * from "./adapter/OllamaAdapter.ts";
export * from "./adapter/OpenAIAdapter.ts";

type ReactiveOrStatic<T> = T | (() => T);

function resolveToStatic<T>(value: ReactiveOrStatic<T>): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

type _OllamaChatParams = Parameters<typeof ollama.chat>["0"];
type Message = NonNullable<_OllamaChatParams["messages"]>[0];

/**
 * Ojjson options
 * @template Input The input schema
 * @template Output The output schema
 */
export type OjjsonOptions<
  // deno-lint-ignore no-explicit-any
  Input extends zod.ZodObject<any>,
  // deno-lint-ignore no-explicit-any
  Output extends zod.ZodObject<any>
> = {
  /**
   * A description how to convert input to export object that will be added to the prompt. This help is prepended with `A description on how to convert input to export object:`
   */
  conversionHelp?: ReactiveOrStatic<string>;
  /**
   * Example input and output objects that will be added to the chat history
   */
  examples?: ReactiveOrStatic<
    Array<{
      input: zod.infer<Input>;
      output: zod.infer<Output>;
    }>
  >;
  /**
   * The maximum number of messages to keep in the chat history
   */
  maxMessages?: number;
  /**
   * Log additional information
   */
  verbose?: boolean;
  /**
   * Ollama options
   */
  ollamaOptions?: ReactiveOrStatic<OllamaOptions>;
  /**
   * Ollama tools
   */
  ollamaTools?: ReactiveOrStatic<OllamaTool[]>;
  /**
   * Ollama keep alive
   */
  ollamaKeepAlive?: ReactiveOrStatic<string | number | undefined>;
};

/**
 * Ojjson generator
 * Allows you to pass in schema instances and generate responses from the model
 * It will automatically validate the input and output with the schema
 * @template Input The input schema
 * @template Output The output schema
 */
export class OjjsonGenerator<
  // deno-lint-ignore no-explicit-any
  Input extends zod.ZodObject<any>,
  // deno-lint-ignore no-explicit-any
  Output extends zod.ZodObject<any>
> {
  /**
   * Create a new OjjsonGenerator
   * @param model The model name
   * @param input The input schema
   * @param output The output schema
   * @param options Additional options

   */
  constructor(
    public adapter: OjjsonAdapter,
    public input: Input,
    public output: Output,
    public options: OjjsonOptions<Input, Output> = {}
  ) {}

  previousMessages: Message[][] = [];

  /**
   * Add a message pair to the chat history
   * @param message The message pair
   */
  addMessagePair(message: Message[]) {
    this.previousMessages.push(message);
    if (this.previousMessages.length > (this.options.maxMessages ?? 10)) {
      this.previousMessages.shift();
    }
  }

  /**
   * Verbose log
   * @param args The arguments to log
   */
  #log(...args: unknown[]) {
    if (this.options.verbose) {
      console.log("[OjjsonGenerator]", ...args);
    }
  }

  /**
   * Extract the json from a string
   * Returns everything between the first `{` and the last `}`
   */
  #extractJson(str: string): string {
    const start = str.indexOf("{");
    const end = str.lastIndexOf("}");
    return str.substring(start, end + 1);
  }

  /**
   * Generate a response from the model
   * You can specify the number of retries and fixTries
   * If the response is a valid json but zod validation fails, it will ask the system to fix the input by providing zod errors, it has `fixTries` attempts to fix the input
   * If the response is not a valid json, or the system fails to fix the input, it will retry `retries` times
   * If all retries fail, it will throw an error
   * @param input The input object
   * @param retries The number of retries to attempt
   * @param fixTries The number of tries to attempt to fix the input
   * @returns The output object
   * @throws If all retries fail
   */
  async generate(
    input: zod.infer<Input>,
    retries = 2,
    fixTries = 1,
    previousMessages?: Message[]
  ): Promise<zod.infer<Output> | null> {
    const examples: Message[] = [];

    for (const example of resolveToStatic(this.options.examples ?? [])) {
      examples.push({ role: "user", content: JSON.stringify(example.input) });
      examples.push({
        role: "system",
        content: JSON.stringify(example.output),
      });
    }

    const prompt = this.#getPromptText();

    const response = await this.adapter.chat(
      [
        ...examples,
        {
          role: "user",
          content: prompt,
        },
        ...((typeof previousMessages !== "undefined") ? previousMessages : this.previousMessages.flat()),
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ]);

    try {
      const out = this.output.parse(
        JSON.parse(this.#extractJson(response.content))
      );

      this.#log({ input, output: out });

      this.addMessagePair([
        { role: "user", content: JSON.stringify(input) },
        response,
      ]);
      return out;
    } catch (e) {
      if (e instanceof zod.ZodError) {
        const exception = e;
        for (let i = 0; i < fixTries; i++) {
          this.#log(
            "zod failed to validate, trying to fix [" + i + "/" + fixTries + "]"
          );
          let fixPrompt = this.#getErrorMessage(exception);

          fixPrompt += `The output you provided was invalid, please provide a valid output that matches the schema. Those issues occured:\n${fixPrompt}`;

          const retry = await this.adapter.chat([
              ...examples,
              {
                role: "user",
                content: prompt,
              },
              {
                role: "user",
                content: JSON.stringify(input),
              },
              {
                role: "system",
                content: this.#extractJson(response.content),
              },
              {
                role: "user",
                content: fixPrompt,
              },
            ]);

          try {
            const out = this.output.parse(
              JSON.parse(this.#extractJson(retry.content))
            );

            this.addMessagePair([
              { role: "user", content: JSON.stringify(input) },
              { role: "system", content: this.#extractJson(response.content) },
            ]);
            return out;
          } catch {
            continue;
          }
        }

        // If not fixed yet, retry whole function
        if (retries > 0) {
          this.#log(
            "Failed to fix, retrying prompt [" + retries + "/" + retries + "]"
          );
          return this.generate(input, retries - 1, fixTries);
        }

        throw e;
      } else {
        throw e;
      }
    }
  }

  /**
   * Get a human readable error message from a zod exception
   * @param exception The zod exception
   * @returns The error message
   */
  #getErrorMessage(exception: zod.ZodError): string {
    let fixPrompt = "";
    exception.errors.forEach((error) => {
      if (error.code == "invalid_union") {
        error.unionErrors.forEach((unionError) => {
          unionError.errors.forEach((err) => {
            if (err.code == "invalid_type") {
              fixPrompt += `* ${err.path.join(".")}: Received ${
                err.received
              } but expected ${err.expected}, ${err.message}\n`;
            } else {
              fixPrompt += `* ${err.path.join(".")}: ${err.message}\n`;
            }
          });
        });
      } else {
        fixPrompt += `* ${error.path.join(".")}: ${error.message}\n`;
      }
    });
    return fixPrompt;
  }

  /**
   * Get the prompt text
   */
  #getPromptText() {
    const conversionHelp = resolveToStatic(this.options.conversionHelp);

    const conversion = resolveToStatic(conversionHelp)
      ? "\n* A description on how to convert input to export object: " +
        conversionHelp +
        "\n\n"
      : "";
    const prompt =
      `You are an AI that receives a JSON object and returns only another JSON object.
* Your input will always be a JSON object that matches the following schema:
${printNode(zodToTs(this.input, undefined, { nativeEnums: "union" }).node)}

* Your output should be a JSON object that matches the following schema:
${printNode(zodToTs(this.output, undefined, { nativeEnums: "union" }).node)}
` +
      conversion +
      `
* You can assume that the input will always be valid and match the schema.
* You can assume that the input will always be a JSON object except incase you've provided an invalid output.
* I will inform you if the output is invalid and you will have to provide a valid output.
* Stricly follow the schema for the output.
* Never return anything other than a JSON object.
* Do not talk to the user.`;

    return prompt;
  }
}
