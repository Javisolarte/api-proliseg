import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FmArchivo } from './fm-archivo.entity';

@Entity('fm_versiones')
export class FmVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'archivo_id', type: 'uuid' })
    archivoId: string;

    @ManyToOne(() => FmArchivo, (archivo) => archivo.versiones)
    @JoinColumn({ name: 'archivo_id' })
    archivo: FmArchivo;

    @Column({ name: 'numero_version', type: 'integer' })
    numeroVersion: number;

    @Column({ name: 'url_storage', type: 'text' })
    urlStorage: string;

    @Column({ name: 'comentario_cambio', type: 'text', nullable: true })
    comentarioCambio: string;

    @Column({ name: 'creado_por', type: 'integer', nullable: true })
    creadoPor: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}
