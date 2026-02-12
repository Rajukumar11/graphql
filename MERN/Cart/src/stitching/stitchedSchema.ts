import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";

export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema],
});