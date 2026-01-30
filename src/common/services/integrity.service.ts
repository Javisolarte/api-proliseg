import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class IntegrityService {
    private readonly logger = new Logger(IntegrityService.name);

    /**
     * Genera un hash HMAC para un objeto de datos
     * Se usa para asegurar que un registro no ha sido alterado
     */
    generateHash(data: any, secret: string = process.env.JWT_SECRET || 'secret'): string {
        const sortedData = this.sortObject(data);
        const dataString = JSON.stringify(sortedData);
        return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
    }

    /**
     * Verifica si el hash de un objeto coincide con el esperado
     */
    verifyIntegrity(data: any, expectedHash: string, secret?: string): boolean {
        const currentHash = this.generateHash(data, secret);
        return currentHash === expectedHash;
    }

    private sortObject(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(this.sortObject.bind(this));

        return Object.keys(obj)
            .sort()
            .reduce((result: any, key) => {
                result[key] = this.sortObject(obj[key]);
                return result;
            }, {});
    }
}
