import zod from 'npm:zod';
import { OjjsonGenerator } from "../mod.ts";

/**
 * Test function
 */
async function test() {
  // const input = zod.object({
  //   resource1: zod.string(),
  //   resource2: zod.string(),
  // });

  // const output = zod.object({
  //   craftedObject: zod.string(),
  //   emoji: zod.string(),
  // });

  // const x = new OjjsonGenerator(
  //   input,
  //   output,
  //   "The input are two resources resulting in a crafted object. The output is the crafted object and a fitting emoji. Don't just add the two resources together, be creative and try to return a fully new object, that in some sort are related to the input.",
  //   {
  //     input: { resource1: "bat", resource2: "man" },
  //     output: { craftedObject: "vampire", emoji: "🦇" },
  //   }
  // );

  // await x.generate({ resource1: "jesus", resource2: "stone" });
  // await x.generate({ resource1: "sword", resource2: "fire" });
  // await x.generate({ resource1: "fish", resource2: "house" });
  // await x.generate({ resource1: "man", resource2: "ears" });
  // await x.generate({ resource1: "obama", resource2: "white" });

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

  const x = new OjjsonGenerator("dolphin-mistral", input, output, {
    conversionHelp:
      "The input is a string that contains an introduction of a person. The output should be an object with the name, age, location, occupation and hobbies of the person. You can leave out any information that is not in the introduction. `hobbies` is a string array.",
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
  });

  console.log(
    "OUT",
    await x.generate({
      introduction: "im kelpy, 26 and i love developing software",
    })
  );
  console.log(
    "OUT",
    await x.generate({
      introduction:
        "whats up id like to apply for the job, im Caryll from the US, Washington and I have a dog, i work full time in a gas station",
    }, )
  );
  console.log(
    "OUT",
    await x.generate({
      introduction:
        "I am thy king Carlos the III. I want to watch you murder everyone, as i always enjoy to see. I've been on this world for 85 long years.",
    })
  );
  console.log(
    "OUT",
    await x.generate({ introduction: "not gonna tell you my name" })
  );

  console.log("Done");
}

test()
