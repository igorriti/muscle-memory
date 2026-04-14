import { generateObject } from 'ai';
import { z } from 'zod';
import { ArgField, MithrilConfig } from '../types.js';

export interface ExtractionResult {
  args: Record<string, any>;
  allRequiredPresent: boolean;
  missingFields: string[];
}

export class ArgExtractor {
  constructor(private config: MithrilConfig) {}

  async extract(
    userMessage: string,
    argSchema: ArgField[],
  ): Promise<ExtractionResult> {
    const shape: Record<string, z.ZodType<any>> = {};
    for (const field of argSchema) {
      let base: z.ZodType<any>;
      switch (field.type) {
        case 'number': base = z.number().describe(field.description); break;
        case 'boolean': base = z.boolean().describe(field.description); break;
        default: base = z.string().describe(field.description); break;
      }
      shape[field.name] = field.required ? base : base.nullable().optional();
    }
    const schema = z.object(shape);

    const regexArgs = this.tryRegex(userMessage, argSchema);
    const regexMissing = argSchema
      .filter(f => f.required && regexArgs[f.name] == null)
      .map(f => f.name);

    if (regexMissing.length === 0) {
      return { args: regexArgs, allRequiredPresent: true, missingFields: [] };
    }

    if (!this.config.extractorModel) {
      return { args: regexArgs, allRequiredPresent: false, missingFields: regexMissing };
    }

    try {
      const { object } = await generateObject({
        model: this.config.extractorModel,
        schema,
        system: `Extract the following fields from the user message. If a field is not present, return null. Fields: ${argSchema.map(f => `${f.name} (${f.type}, ${f.required ? 'required' : 'optional'}): ${f.description}`).join('; ')}`,
        prompt: userMessage,
        temperature: 0,
      });

      const missing = argSchema
        .filter(f => f.required && (object as any)[f.name] == null)
        .map(f => f.name);

      return {
        args: object as Record<string, any>,
        allRequiredPresent: missing.length === 0,
        missingFields: missing,
      };
    } catch {
      return {
        args: {},
        allRequiredPresent: false,
        missingFields: argSchema.filter(f => f.required).map(f => f.name),
      };
    }
  }

  private tryRegex(text: string, fields: ArgField[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const field of fields) {
      if (field.type === 'string' && field.name.toLowerCase().includes('id')) {
        const match = text.match(/(?:ORD-?|#|order|pedido|orden)\s*(\d+)/i);
        if (match) result[field.name] = match[1];
      }
      if (field.type === 'string' && field.name.toLowerCase().includes('email')) {
        const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (match) result[field.name] = match[0];
      }
    }
    return result;
  }
}
