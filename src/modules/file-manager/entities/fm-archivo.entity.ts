import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { FmCarpeta } from './fm-carpeta.entity';

@Entity('fm_archivos')
export class FmArchivo {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'propietario_id', type: 'integer' })
    propietarioId: number;

    @Column({ name: 'carpeta_id', type: 'uuid', nullable: true })
    carpetaId: string | null;

    @ManyToOne(() => FmCarpeta, { nullable: true })
    @JoinColumn({ name: 'carpeta_id' })
    carpeta: FmCarpeta;

    @Column({ name: 'nombre_archivo', type: 'text' })
    nombreArchivo: string;

    @Column({ type: 'text', nullable: true })
    extension: string;

    @Column({ name: 'mime_type', type: 'text', nullable: true })
    mimeType: string;

    @Column({ name: 'tamano_bytes', type: 'bigint', nullable: true })
    tamanoBytes: string; // TypeORM uses string for bigint to avoid precision loss

    @Column({ type: 'text', default: 'privado' })
    visibilidad: string; // 'privado', 'compartido', 'publico'

    @Column({ type: 'boolean', default: false })
    eliminado: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @OneToMany('FmVersion', (version: any) => version.archivo)
    versiones: any[];
}
