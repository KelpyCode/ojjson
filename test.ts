import zod from "npm:zod";
import { OjjsonGenerator } from "./mod.ts";
import { assertEquals, assertExists } from "@std/assert";
import { OllamaAdapter } from "./adapter/OllamaAdapter.ts";

const ollamaAdapter = new OllamaAdapter("llama3.1");

Deno.test("Data extraction", async (t) => {
  const input = zod.object({
    introduction: zod.string(),
  });

  const output = zod.object({
    name: zod.string(),
    age: zod.number(),
    location: zod.string(),
    occupation: zod.string(),
    hobbies: zod.array(zod.string()),
  });

  const ojjson = new OjjsonGenerator(ollamaAdapter, input, output, {
    conversionHelp:
      "The input is a string that contains an introduction of a person. The output should be an object with the name, age, location, occupation and hobbies of the person. You can leave out any information that is not in the introduction by setting it to either 0 or \"\". `hobbies` is a string array.",
    examples: [
      {
        input: {
          introduction:
            "Hey guys im james from austria, i love to take long walks on the beach and im 21",
        },
        output: {
          name: "James",
          age: 21,
          location: "austria",
          occupation: "",
          hobbies: ["long walks on the beach"],
        },
      },
      {
        input: { introduction: "im Peter and im 43 years old" },
        output: {
          name: "Peter",
          age: 43,
          location: "",
          occupation: "",
          hobbies: [],
        },
      },
    ],
    verbose: true,
  });

  const tests: [string, (out: zod.infer<typeof output>) => void][] = [
    [
      "Hey guys, its me kelpy. I am 26 years old and i love developing software. Sometimes i produce a little bit of music and take long walks on the beach",
      (out) => {
        assertEquals(out.name.toLowerCase(), "kelpy");
        assertEquals(out.age, 26);
        assertEquals(out.location, "");
      },
    ],
    [
      "Jennifer, 32, from the US. I love hiking but at work i save lives",
      (out) => {
        assertEquals(out.name.toLowerCase(), "jennifer");
        assertEquals(out.age, 32);
      },
    ],
    [
      "I won't tell you who i am",
      (out) => {
        assertEquals(out.name, "");
        assertEquals(out.age, 0);
        assertEquals(out.location, "");
      },
    ],
    [
      "I am a ghost, boo!",
      (out) => {
        assertEquals(out.age, 0);
        assertEquals(out.location, "");
      },
    ],
  ];

  for (const test of tests) {
    await t.step(test[0], async () => {
      const result = await ojjson.generate({ introduction: test[0] });
      console.log("Input: " + test[0]);
      console.log("Output:" + JSON.stringify(result, null, 2));
      assertExists(result);
      test[1](result!);
      console.log("----------------");
    });
  }
});
