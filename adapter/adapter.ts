export type OjjsonChatMessage = { role: string; content: string };

export class OjjsonAdapter {
  constructor(public model: string) {}

  chat(message: OjjsonChatMessage[]): Promise<OjjsonChatMessage> {
    void message;
    throw new Error("Method not implemented.");
  }
}
