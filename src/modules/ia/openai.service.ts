import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIService {
  private client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async naturalToSQL(userQuery: string, schema: string): Promise<string> {
    const prompt = `
Eres un experto en bases de datos PostgreSQL.
Convierte esta solicitud en una consulta SQL válida y segura.
Usa solo SELECT (sin INSERT, UPDATE ni DELETE).
Usa este esquema:
${schema}

Solicitud: "${userQuery}"

Responde solo con la consulta SQL, sin explicaciones ni comentarios.
`;

    const res = await this.client.chat.completions.create({
      model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: Number(this.config.get('OPENAI_MAX_TOKENS')) || 800,
    });

    const sql = res.choices[0].message?.content?.trim() || '';
    return sql.replace(/```sql|```/g, '').trim();
  }
}
