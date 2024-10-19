# ojjson

ojjson is a library designed to facilitate JSON interactions with Ollama, a large language api (LLM). It leverages the power of Zod for schema validation, ensuring that the JSON input and output conform to specified structures.

## Features

- **OjjsonGenerator**: The core component of the library, found in `mod.ts`.
- **Schema Validation**: Uses Zod to define and enforce input and output schemas.
- **Automatic Retries**: If validation fails, the library automatically retries by providing the encountered issues to the Ollama chat.

## Installation

To install ojjson, you can use the following command:

### Deno
```sh
deno install ojjson
```

### Node.js
```sh
npm install ojjson
```

### PHP
```sh	
just kidding lol
```

## Usage

Here's a basic example of how to use ojjson:

```typescript
import { OjjsonGenerator } from "ojjson";
import { z } from "zod";

// Define input and output schemas using Zod

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

// Create an instance of OjjsonGenerator
const ojjson = new OjjsonGenerator("dolphin-mistral", input, output, {
  // Optional configuration
  // How many messages to remember in the chat (default: 10)
  // One message = one pair of user and system messages
  maxMessages: 10,
  // conversionHelp is a string that will be put into the prompt, giving more accurate information on how to map the input to the output, while this is optional, it is recommended to provide it for better results and especially in case of complex conversions
  conversionHelp:
    "The input is a string that contains an introduction of a person. The output should be an object with the name, age, location, occupation and hobbies of the person. You can leave out any information that is not in the introduction. `hobbies` is a string array.",
  // You can provide examples to help the model understand the conversion. Those will internally be used as previous messages in the chat.
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

await ojjson.generate(
  {
    introduction:
      "whats up id like to apply for the job, im Caryll from the US, Washington and I have a dog, i work full time in a gas station",
  },
  // Optional parameters
  // The number of retries to attempt if the conversion fails or fix tries failed (default: 2)
  /*retries*/ 2,
  // The number of tries to attempt fixing the conversion if the conversion fails (default: 2)
  /*fixTries*/ 2
);


/* Output: */
{
    name: 'Caryll',
    age: 0,
    location: 'Washington, USA',
    occupation: 'Gas station employee',
    hobbies: ['owns a dog']
}


```


## License

This project is licensed under the MIT License.
