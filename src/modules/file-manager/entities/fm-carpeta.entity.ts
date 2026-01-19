import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('fm_carpetas')
export class FmCarpeta {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'propietario_id', type: 'integer' })
    propietarioId: number;

    @Column({ name: 'parent_id', type: 'uuid', nullable: true })
    parentId: string | null;

    @ManyToOne(() => FmCarpeta, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent: FmCarpeta;

    @Column({ type: 'text' })
    nombre: string;

    @Column({ type: 'text', default: '#F0F0F0' })
    color: string;

    @Column({ type: 'boolean', default: false })
    eliminado: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
