import { OjjsonAdapter, type OjjsonChatMessage } from "./adapter.ts";
import type OpenAI from "npm:openai@4.68.1";

export class OpenAIAdapter extends OjjsonAdapter {
  constructor(
    model: string,
    public openAiInstance: InstanceType<typeof OpenAI>
  ) {
    super(model);
  }
  override async chat(
    messages: OjjsonChatMessage[]
  ): Promise<OjjsonChatMessage> {
    const response = await this.openAiInstance.chat.completions.create({
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      model: this.model,
      tool_choice: "none",
      response_format: {"type": "json_object"}
    });

    const message = response.choices[0].message;

    return { content: message.content ?? "", role: message.role };
  }
}
