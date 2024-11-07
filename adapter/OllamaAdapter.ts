import { OjjsonAdapter, type OjjsonChatMessage } from "./adapter.ts";
import ollama, {
  type Options as OllamaOptions,
} from "npm:ollama@0.5.9";

export class OllamaAdapter extends OjjsonAdapter {
  constructor(model: string, public config?: Partial<OllamaOptions>) {
    super(model);
  }

  override async chat(messages: OjjsonChatMessage[]): Promise<OjjsonChatMessage> {
    const response = await ollama.chat({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      format: "json",
      options: this.config,
    });
      
    return { content: response.message.content, role: response.message.role };
  }
}
