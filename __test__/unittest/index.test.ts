/**
 * @jest-environment node
 */

import { default as axios } from "axios";
import APIQueryDispatcher from "../../src/index";
// jest.mock('@biothings-explorer/api-response-transform', () => {
//     // Works and lets you check for constructor calls:
//     return jest.fn().mockImplementation((res) => {
//         return { transform: () => [{ v: true }] };
//     });
// });

jest.mock("../../src/query_queue", () => {
  // Works and lets you check for constructor calls:
  return jest.fn().mockImplementation(res => {
    return {
      addQuery: () => undefined,
      constructQueue: () => undefined,
    };
  });
});

// jest.mock('axios');

describe("Test query class", () => {
  describe("test _annotate function", () => {
    test("check if annotated ids are correctly mapped", async () => {
      const res = [
        {
          apiEdge: {
            input_type: "Gene",
            output_type: "SmallMolecule",
          },
          subject: {
            original: "NCBIGene:1017",
          },
          object: {
            original: "CHEBI:1234",
          },
        },
        {
          apiEdge: {
            input_type: "Gene",
            output_type: "SmallMolecule",
          },
          subject: {
            original: "NCBIGene:1017",
          },
          object: {
            original: "CHEBI:1234",
          },
        },
      ];
      const caller = new APIQueryDispatcher([]);
      // @ts-expect-error partial data to test specific functionality
      const annotatedResult = await caller._annotate(res);
      expect(annotatedResult).toHaveLength(2);
    });

    test("if set enabled equal to false, return the result itself", async () => {
      const res = [
        {
          apiEdge: {
            input_type: "Gene",
            output_type: "SmallMolecule",
          },
          subject: {
            original: "NCBIGene:1017",
          },
          object: {
            original: "CHEBI:1234",
          },
        },
        {
          apiEdge: {
            input_type: "Gene",
            output_type: "SmallMolecule",
          },
          subject: {
            original: "NCBIGene:1017",
          },
          object: {
            original: "CHEBI:1234",
          },
        },
      ];
      const caller = new APIQueryDispatcher([]);
      // @ts-expect-error partial data to test specific functionality
      const annotatedResult = await caller._annotate(res, false);
      expect(annotatedResult).toEqual(res);
    });
  });
});
