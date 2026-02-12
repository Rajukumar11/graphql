import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";
import { presenceSchema } from "../presence/schema";
import { paginationSchema } from "../pagination/schema";

export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema,presenceSchema,paginationSchema],
});