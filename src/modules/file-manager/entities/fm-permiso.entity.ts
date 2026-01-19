import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FmArchivo } from './fm-archivo.entity';
import { FmCarpeta } from './fm-carpeta.entity';

@Entity('fm_permisos')
export class FmPermiso {
    @PrimaryGeneratedColumn('identity', { name: 'id', generatedIdentity: 'ALWAYS' })
    id: number;

    @Column({ name: 'usuario_destino_id', type: 'integer' })
    usuarioDestinoId: number;

    @Column({ name: 'archivo_id', type: 'uuid', nullable: true })
    archivoId: string | null;

    @ManyToOne(() => FmArchivo, { nullable: true })
    @JoinColumn({ name: 'archivo_id' })
    archivo: FmArchivo;

    @Column({ name: 'carpeta_id', type: 'uuid', nullable: true })
    carpetaId: string | null;

    @ManyToOne(() => FmCarpeta, { nullable: true })
    @JoinColumn({ name: 'carpeta_id' })
    carpeta: FmCarpeta;

    @Column({ type: 'text', default: 'lectura' })
    permiso: string; // 'lectura', 'escritura'

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}
