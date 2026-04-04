import { z } from 'zod';

export const nhisUpdateSchema = z.object({
  fullName: z.string().trim().optional(),
  situationCase: z.string().trim().optional().nullable(),
  amount: z.union([z.number(), z.string().trim()]).optional(),
  programYear: z.union([z.number(), z.string()]).optional(),
  expectedUpdatedAt: z.string().trim().optional().nullable()
});

export const peopleUpdateSchema = z.object({
  firstName: z.string().trim().optional().nullable(),
  lastName: z.string().trim().optional().nullable(),
  otherNames: z.string().trim().optional().nullable(),
  dob: z.string().trim().optional().nullable(),
  age: z.union([z.number(), z.string().trim()]).optional().nullable(),
  gender: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  addressLine1: z.string().trim().optional().nullable(),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  nationality: z.string().trim().optional().nullable(),
  idType: z.string().trim().optional().nullable(),
  idNumber: z.string().trim().optional().nullable(),
  emergencyName: z.string().trim().optional().nullable(),
  emergencyPhone: z.string().trim().optional().nullable(),
  registrationSource: z.string().trim().optional().nullable(),
  occupation: z.string().trim().optional().nullable(),
  reasonForComing: z.string().trim().optional().nullable(),
  programYear: z.union([z.number(), z.string()]).optional().nullable(),
  onboardingStatus: z.string().trim().optional().nullable(),
  onboardingDate: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  expectedUpdatedAt: z.string().trim().optional().nullable()
});

export const nhisCreateSchema = z.object({
  fullName: z.string().trim().min(1, 'fullName is required'),
  situationCase: z.string().trim().optional().nullable(),
  amount: z.union([z.number(), z.string().trim()]).optional(),
  programYear: z.union([z.number(), z.string()]).optional(),
  clientRequestId: z.string().trim().optional().nullable()
});

export const peopleCreateSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName is required'),
  lastName: z.string().trim().min(1, 'lastName is required'),
  otherNames: z.string().trim().optional().nullable(),
  dob: z.string().trim().optional().nullable(),
  age: z.union([z.number(), z.string().trim()]).optional().nullable(),
  gender: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  addressLine1: z.string().trim().optional().nullable(),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  nationality: z.string().trim().optional().nullable(),
  idType: z.string().trim().optional().nullable(),
  idNumber: z.string().trim().optional().nullable(),
  emergencyName: z.string().trim().optional().nullable(),
  emergencyPhone: z.string().trim().optional().nullable(),
  registrationSource: z.string().trim().optional().nullable(),
  occupation: z.string().trim().optional().nullable(),
  reasonForComing: z.string().trim().optional().nullable(),
  programYear: z.union([z.number(), z.string()]).optional(),
  onboardingStatus: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  clientRequestId: z.string().trim().optional().nullable()
});

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message
      }));
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    req.body = result.data;
    next();
  };
}
