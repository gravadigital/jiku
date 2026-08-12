import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import logger from '../logger';

/**
 * Prefijo de las claves de los objetos en el bucket.
 *
 * Configurable, pero con el valor histórico como default a propósito: cambiarlo en una
 * instalación existente deja inaccesibles los adjuntos ya subidos, porque la clave se
 * guarda en `attachments.storage_key`.
 */
export const STORAGE_KEY_PREFIX = process.env.STORAGE_S3_KEY_PREFIX || 'grava-gestion';

interface UploadResult {
  key: string;
  bucket: string;
  region: string;
  etag: string;
  size: number;
}

interface FileMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
}

interface ListedFile {
  key: string;
  size: number;
  lastModified: Date;
}

class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  constructor() {
    const endpoint = process.env.STORAGE_S3_ENDPOINT;
    const accessKeyId = process.env.STORAGE_S3_CREDENTIALS_ACCESSKEY;
    const secretAccessKey = process.env.STORAGE_S3_CREDENTIALS_SECRETKEY;
    const bucket = process.env.STORAGE_S3_BUCKETNAME;
    const region = process.env.STORAGE_S3_REGION;
    const forcePathStyle = process.env.STORAGE_S3_FORCEPATHSTYLE === 'true';

    // Sin defaults: el bucket y la región dependen del proveedor de cada instalación
    // (AWS S3, MinIO, Spaces, R2). Un default acá apuntaría a la infraestructura de
    // otro, y el error recién aparecería al subir el primer archivo.
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !region) {
      throw new Error(
        'Missing S3 storage configuration: STORAGE_S3_ENDPOINT, ' +
        'STORAGE_S3_CREDENTIALS_ACCESSKEY, STORAGE_S3_CREDENTIALS_SECRETKEY, ' +
        'STORAGE_S3_BUCKETNAME and STORAGE_S3_REGION are all required.'
      );
    }

    this.bucket = bucket;
    this.region = region;

    this.s3Client = new S3Client({
      endpoint,
      region: this.region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });

    logger.info(`StorageService initialized: bucket=${this.bucket}, region=${this.region}`);
  }

  async uploadFromBuffer(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: 'private',
      });
      const response = await this.s3Client.send(command);
      logger.info(`File uploaded: key=${key}, size=${buffer.length}`);
      return { key, bucket: this.bucket, region: this.region, etag: response.ETag || '', size: buffer.length };
    } catch (error: any) {
      logger.error(`Upload failed: key=${key}, error=${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new Error('Empty response body');
      }
      logger.info(`File stream retrieved: key=${key}`);
      return response.Body as Readable;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        logger.warn(`File not found: key=${key}`);
        throw new Error(`File not found: ${key}`);
      }
      logger.error(`Get file stream failed: key=${key}, error=${error.message}`);
      throw new Error(`Failed to get file stream: ${error.message}`);
    }
  }

  async deleteFile(key: string): Promise<{ deleted: boolean }> {
    try {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.s3Client.send(command);
      logger.info(`File deleted: key=${key}`);
      return { deleted: true };
    } catch (error: any) {
      logger.error(`Delete failed: key=${key}, error=${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async listByPrefix(prefix: string): Promise<ListedFile[]> {
    const files: ListedFile[] = [];
    let continuationToken: string | undefined;
    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });
        const response = await this.s3Client.send(command);
        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key && item.Size !== undefined && item.LastModified) {
              files.push({ key: item.Key, size: item.Size, lastModified: item.LastModified });
            }
          }
        }
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
      logger.info(`Listed files: prefix=${prefix}, count=${files.length}`);
      return files;
    } catch (error: any) {
      logger.error(`List failed: prefix=${prefix}, error=${error.message}`);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 60): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      logger.info(`Presigned URL generated: key=${key}, expiresIn=${expiresIn}s`);
      return url;
    } catch (error: any) {
      logger.error(`Presign failed: key=${key}, error=${error.message}`);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async headObject(key: string): Promise<FileMetadata> {
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.s3Client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
      };
    } catch (error: any) {
      if (error.name === 'NotFound') {
        throw new Error(`File not found: ${key}`);
      }
      logger.error(`Head object failed: key=${key}, error=${error.message}`);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}

export default new StorageService();
