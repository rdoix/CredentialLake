/**
 * Global Validation Pipe Configuration
 * Validates and sanitizes all incoming requests
 */

import { ValidationPipe, BadRequestException } from '@nestjs/common';

export const globalValidationPipe = new ValidationPipe({
  // Strip properties that don't have decorators
  whitelist: true,
  
  // Throw error if non-whitelisted properties are present
  forbidNonWhitelisted: true,
  
  // Automatically transform payloads to DTO instances
  transform: true,
  
  // Transform primitive types
  transformOptions: {
    enableImplicitConversion: true,
  },
  
  // Custom error message formatting
  exceptionFactory: (errors) => {
    const messages = errors.map((error) => {
      const constraints = error.constraints;
      return constraints
        ? Object.values(constraints).join(', ')
        : 'Validation failed';
    });
    return new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: messages,
    });
  },
});