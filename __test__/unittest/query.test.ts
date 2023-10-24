/**
 * @jest-environment node
 */

import { default as axios } from "axios";
import APIQueryDispatcher from "../../src/query";
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
  describe("Test _merge function", () => {
    test("Failed promise should be excluded in the result", () => {
      const success = {
        status: "fulfilled",
        value: [{ id: 1 }],
      };
      const fail = {
        status: "rejected",
        reason: "bad request",
      };
      const caller = new APIQueryDispatcher([]);
      // @ts-expect-error partial data to test specific functionality
      const res = caller._merge([success, fail, fail]);
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual(success.value[0]);
    });

    test("successful promise should be correctly merged", () => {
      const success1 = {
        status: "fulfilled",
        value: [{ id: 1 }],
      };
      const success2 = {
        status: "fulfilled",
        value: [{ id: 3 }],
      };
      const fail = {
        status: "rejected",
        reason: "bad request",
      };
      const caller = new APIQueryDispatcher([]);
      // @ts-expect-error partial data to test specific functionality
      const res = caller._merge([success1, success2, success1, fail, fail]);
      expect(res).toHaveLength(3);
      expect(res[0]).toEqual(success1.value[0]);
      expect(res[1]).toEqual(success2.value[0]);
      expect(res[2]).toEqual(success1.value[0]);
    });
  });

  // function removed
  // TODO: rewrite this test for _groupCuriesBySemanticType()
  // describe("Test _groupOutputIDsBySemanticType function", () => {
  //   test("Empty result should return an empty dict", () => {
  //     const caller = new APIQueryDispatcher([]);
  //     const res = caller._groupOutputIDsBySemanticType([]);
  //     expect(res).toEqual({});
  //   });
  //
  //   test("Output IDs are correctly grouped", () => {
  //     const caller = new APIQueryDispatcher([]);
  //     const result = [
  //       {
  //         apiEdge: {
  //           output_type: "Gene",
  //         },
  //         object: {
  //           original: "NCBIGene:1017",
  //         },
  //       },
  //       {
  //         apiEdge: {
  //           output_type: "Gene",
  //         },
  //         object: {
  //           original: "NCBIGene:1018",
  //         },
  //       },
  //       {
  //         apiEdge: {
  //           output_type: "Disease",
  //         },
  //         object: {
  //           original: "MONDO:1234",
  //         },
  //       },
  //     ];
  //     const res = caller._groupOutputIDsBySemanticType(result);
  //     expect(res).toHaveProperty("Disease");
  //     expect(res.Disease).toEqual(["MONDO:1234"]);
  //     expect(res).toHaveProperty("Gene");
  //     expect(res.Gene).toEqual(["NCBIGene:1017", "NCBIGene:1018"]);
  //   });
  // });

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

  // describe("test _queryBucket function", () => {
  //     test("test _queryBucket function", async () => {
  //         const queries = [
  //             {
  //                 getConfig() {
  //                     return {};
  //                 },
  //                 needPagination(res) {
  //                     return false;
  //                 }
  //             }
  //         ];
  //         const mockRes = {
  //             data: {
  //                 gene: 1017
  //             }
  //         }
  //         axios.mockResolvedValue(mockRes);
  //         const caller = new q([]);
  //         caller.queue = {
  //             dequeue() {
  //                 return true;
  //             }
  //         };
  //         const res = await caller._queryBucket(queries);
  //         console.log('res', res)
  //         expect(res).toHaveLength(1);
  //         expect(res[0]).toHaveProperty('status', 'fulfilled');
  //         expect(res[0]).toHaveProperty('value', [{ v: true }])
  //     })
  // })
});
