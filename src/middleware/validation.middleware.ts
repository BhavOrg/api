import { Request, Response, NextFunction } from "express";
import { ApiError } from "../types/request.types";

interface ValidationRule {
  type: string;
  required?: boolean;
  optional?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean;
}

interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: { field: string; message: string }[] = [];

      // Validate body
      if (schema.body) {
        Object.entries(schema.body).forEach(([field, rules]) => {
          const value = req.body[field];

          // Check required fields
          if (
            rules.required &&
            (value === undefined || value === null || value === "")
          ) {
            errors.push({ field, message: `${field} is required` });
            return;
          }

          // Skip validation for optional empty fields
          if (
            (rules.optional || !rules.required) &&
            (value === undefined || value === null || value === "")
          ) {
            return;
          }

          // Type validation
          if (rules.type === "string" && typeof value !== "string") {
            errors.push({ field, message: `${field} must be a string` });
          }

          if (
            rules.type === "number" &&
            (typeof value !== "number" || isNaN(value))
          ) {
            errors.push({ field, message: `${field} must be a number` });
          }

          // Length validation for strings
          if (typeof value === "string") {
            if (rules.min !== undefined && value.length < rules.min) {
              errors.push({
                field,
                message: `${field} must be at least ${rules.min} characters`,
              });
            }

            if (rules.max !== undefined && value.length > rules.max) {
              errors.push({
                field,
                message: `${field} must be at most ${rules.max} characters`,
              });
            }
          }

          // Pattern validation
          if (
            rules.pattern &&
            typeof value === "string" &&
            !rules.pattern.test(value)
          ) {
            errors.push({ field, message: `${field} has an invalid format` });
          }

          // Enum validation
          if (rules.enum && !rules.enum.includes(value)) {
            errors.push({
              field,
              message: `${field} must be one of: ${rules.enum.join(", ")}`,
            });
          }

          // Custom validation
          if (rules.custom && !rules.custom(value)) {
            errors.push({ field, message: `${field} is invalid` });
          }
        });
      }

      // Similar validation for params and query if needed

      // If there are errors, throw an ApiError
      if (errors.length > 0) {
        throw new ApiError("Validation failed", 400, errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
