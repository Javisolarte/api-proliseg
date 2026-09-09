import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

export class LocalStorageBucketApi {
  private readonly logger = new Logger(LocalStorageBucketApi.name);
  private bucketDir: string;
  private bucketName: string;
  private publicBaseUrl: string;

  constructor(bucketName: string, baseDir: string, publicBaseUrl: string) {
    this.bucketName = bucketName;
    this.bucketDir = path.join(baseDir, bucketName);
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
    if (!fs.existsSync(this.bucketDir)) {
      fs.mkdirSync(this.bucketDir, { recursive: true });
    }
  }

  async upload(
    filePath: string,
    fileBody: Buffer | ArrayBuffer | string | any,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: { path: string; id: string; fullPath: string } | null; error: any }> {
    try {
      // Limpiar path
      const cleanPath = filePath.replace(/^\/+/, '');
      const fullLocalPath = path.join(this.bucketDir, cleanPath);
      const dir = path.dirname(fullLocalPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let buffer: Buffer;
      if (Buffer.isBuffer(fileBody)) {
        buffer = fileBody;
      } else if (fileBody instanceof ArrayBuffer) {
        buffer = Buffer.from(fileBody);
      } else if (typeof fileBody === 'string') {
        buffer = Buffer.from(fileBody, 'utf8');
      } else if (fileBody && fileBody.buffer) {
        buffer = Buffer.from(fileBody.buffer);
      } else {
        buffer = Buffer.from(fileBody);
      }

      await fs.promises.writeFile(fullLocalPath, buffer);

      return {
        data: {
          path: cleanPath,
          id: cleanPath,
          fullPath: `${this.bucketName}/${cleanPath}`,
        },
        error: null,
      };
    } catch (err: any) {
      this.logger.error(`Error al guardar archivo en ${this.bucketName}/${filePath}: ${err.message}`);
      return { data: null, error: { message: err.message } };
    }
  }

  getPublicUrl(filePath: string): { data: { publicUrl: string } } {
    const cleanPath = filePath.replace(/^\/+/, '');
    const publicUrl = `${this.publicBaseUrl}/storage/${this.bucketName}/${cleanPath}`;
    return {
      data: {
        publicUrl,
      },
    };
  }

  async createSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<{ data: { signedUrl: string } | null; error: any }> {
    // Al ser nuestro propio servidor de storage seguro, devolvemos la URL pública directa
    const { data } = this.getPublicUrl(filePath);
    return {
      data: {
        signedUrl: data.publicUrl,
      },
      error: null,
    };
  }

  async remove(paths: string[]): Promise<{ data: string[] | null; error: any }> {
    try {
      for (const p of paths) {
        const cleanPath = p.replace(/^\/+/, '');
        const fullLocalPath = path.join(this.bucketDir, cleanPath);
        if (fs.existsSync(fullLocalPath)) {
          await fs.promises.unlink(fullLocalPath);
        }
      }
      return { data: paths, error: null };
    } catch (err: any) {
      this.logger.error(`Error al eliminar archivo en ${this.bucketName}: ${err.message}`);
      return { data: null, error: { message: err.message } };
    }
  }

  async download(filePath: string): Promise<{ data: Blob | null; error: any }> {
    try {
      const cleanPath = filePath.replace(/^\/+/, '');
      const fullLocalPath = path.join(this.bucketDir, cleanPath);
      if (!fs.existsSync(fullLocalPath)) {
        return { data: null, error: { message: 'Archivo no encontrado' } };
      }
      const buffer = await fs.promises.readFile(fullLocalPath);
      const blob = new Blob([new Uint8Array(buffer)]);
      return { data: blob as any, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async list(prefix = '', options?: any): Promise<{ data: any[] | null; error: any }> {
    try {
      const searchDir = prefix ? path.join(this.bucketDir, prefix) : this.bucketDir;
      if (!fs.existsSync(searchDir)) {
        return { data: [], error: null };
      }
      const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });
      const data = entries.map((entry) => ({
        name: entry.name,
        id: entry.isDirectory() ? null : entry.name,
        metadata: {
          size: entry.isDirectory() ? 0 : fs.statSync(path.join(searchDir, entry.name)).size,
        },
      }));
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}

export class LocalStorageClient {
  private baseDir: string;
  private publicBaseUrl: string;

  constructor(baseDir?: string, publicBaseUrl?: string) {
    this.baseDir = baseDir || process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    this.publicBaseUrl = publicBaseUrl || process.env.API_PUBLIC_URL || 'https://api.proliseg.com';
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  from(bucket: string) {
    return new LocalStorageBucketApi(bucket, this.baseDir, this.publicBaseUrl);
  }

  async listBuckets() {
    try {
      const entries = await fs.promises.readdir(this.baseDir, { withFileTypes: true });
      return {
        data: entries.filter(e => e.isDirectory()).map(e => ({ name: e.name, public: true })),
        error: null
      };
    } catch (err: any) {
      return { data: [], error: { message: err.message } };
    }
  }
}
