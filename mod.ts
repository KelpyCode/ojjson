import ollama from "npm:ollama@0.5.9";
import zod, { type ZodRawShape } from "npm:zod@3.23.8";

function generateZodExample<T extends ZodRawShape>(
  schema: zod.ZodObject<T>
): T {
  const example: T = {} as T;
  for (const key in schema.shape) {
    const shape = schema.shape[key];
    // deno-lint-ignore no-explicit-any
    const exAny: any = example as any;
    if (shape instanceof zod.ZodString) {
      exAny[key] = "";
    } else if (shape instanceof zod.ZodNumber) {
      exAny[key] = 0;
    } else if (shape instanceof zod.ZodBoolean) {
      exAny[key] = true;
    } else if (shape instanceof zod.ZodArray) {
      exAny[key] = [];
    } else if (shape instanceof zod.ZodObject) {
      exAny[key] = generateZodExample(shape);
    }
  }
  return example;
}

type _OllamaChatParams = Parameters<typeof ollama.chat>["0"];
type Message = NonNullable<_OllamaChatParams["messages"]>[0];

export class OjjsonGenerator<
  // deno-lint-ignore no-explicit-any
  Input extends zod.ZodObject<any>,
  // deno-lint-ignore no-explicit-any
  Output extends zod.ZodObject<any>
> {
  constructor(
    public model: string,
    public input: Input,
    public output: Output,
    public options: {
      conversionHelp?: string;
      examples?: Array<{ input: zod.infer<Input>; output: zod.infer<Output> }>;
      maxMessages?: number;
      verbose?: boolean;
    } = {}
  ) {
  }

  previousMessages: Message[][] = [];

  addMessage(message: Message[]) {
    this.previousMessages.push(message);
    if (this.previousMessages.length > (this.options.maxMessages ?? 10)) {
      this.previousMessages.shift();
    }
  }

  #log(...args: unknown[]) {
    if (this.options.verbose) {
      console.log('[OjjsonGenerator]',...args);
    }
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
    fixTries = 1
  ): Promise<zod.infer<Output> | null> {
    const examples: Message[] = [];

    for (const example of this.options.examples ?? []) {
      examples.push({ role: "user", content: JSON.stringify(example.input) });
      examples.push({
        role: "system",
        content: JSON.stringify(example.output),
      });
    }

    const prompt = this.#getPromptText();

    const x = await ollama.chat({
      format: "json",
      model: this.model,
      messages: [
        ...examples,
        {
          role: "user",
          content: prompt,
        },
        ...this.previousMessages.flat(),
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    try {
      const out = this.output.parse(JSON.parse(x.message.content));

      this.#log({ input, output: out });

      this.addMessage([
        { role: "user", content: JSON.stringify(input) },
        x.message,
      ]);
      return out;
    } catch (e) {
      if (e instanceof zod.ZodError) {
        const exception = e;
        for (let i = 0; i < fixTries; i++) {
          this.#log("zod failed to validate, trying to fix ["+i+"/"+fixTries+"]")
          let fixPrompt = this.#getErrorMessage(exception);

          fixPrompt += `The output you provided was invalid, please provide a valid output that matches the schema. Those issues occured:\n${fixPrompt}`

          const retry = await ollama.chat({
            format: "json",
            model: this.model,
            messages: [
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
                content: x.message.content,
              },
              {
                role: "user",
                content: fixPrompt,
              },
            ],
          });

          try {
            const out = this.output.parse(JSON.parse(retry.message.content));


            this.addMessage([
              { role: "user", content: JSON.stringify(input) },
              { role: "system", content: x.message.content },
            ]);
            return out;
          } catch {
            continue;
          }
        }

        // If not fixed yet, retry whole function
        if (retries > 0) {
          this.#log("Failed to fix, retrying prompt ["+retries+"/"+retries+"]")
          return this.generate(input, retries - 1, fixTries);
        }

        throw e;
      } else {
        throw e;
      }
    }
  }

  #getErrorMessage(exception: zod.ZodError): string {
    let fixPrompt = '';
    exception.errors.forEach((error) => {
      if (error.code == 'invalid_union') {
        error.unionErrors.forEach((unionError) => {
          unionError.errors.forEach(err => {
            if (err.code == 'invalid_type') {
              fixPrompt += `* ${err.path.join(".")}: Received ${err.received} but expected ${err.expected}, ${err.message}\n`;
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

  #getPromptText() {
    const conversion = this.options.conversionHelp
      ? "\n* A description how to convert input to export object: " +
        this.options.conversionHelp +
        "\n\n"
      : "";
    const prompt =
      `You are an AI that recieves a JSON object and returns only another JSON object.
* Your input will always be a JSON object that matches the following schema:
${JSON.stringify(generateZodExample(this.input), null, 2)}

* Your output should be a JSON object that matches the following schema:
${JSON.stringify(generateZodExample(this.output), null, 2)}
` +
      conversion +
      `
* You can assume that the input will always be valid and match the schema.
* You can assume that the input will always be a JSON object.
* Stricly follow the schema for the output.
* Never return anything other than a JSON object.
* Do not talk to the user.`;
    return prompt;
  }
}

