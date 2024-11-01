import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserModel } from '../user';
import { BoardCommentModel } from '../board-comment';
import { IsEnum } from 'class-validator';
import { BoardStatusEnum } from '~/type/enum/board';

@Entity({ name: 'board', comment: '게시판 테이블' })
export class BoardModel {
  @PrimaryGeneratedColumn({ name: 'seq', type: 'bigint', comment: 'boardSeq' })
  seq: number;

  @Column({ name: 'writer_seq', type: 'bigint', comment: '작성자' })
  writer_seq: number;

  @Column({ name: 'title', type: 'text', comment: '제목' })
  title: string;

  @Column({ name: 'content', type: 'text', comment: '내용' })
  content: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '생성일' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', comment: '수정일' })
  updatedAt: Date;

  @Column({ name: 'status', type: 'varchar', length: 10, comment: '상태' })
  @IsEnum(BoardStatusEnum)
  status: BoardStatusEnum;

  @OneToMany(() => BoardCommentModel, (comment) => comment.board)
  comments: BoardCommentModel[];

  @ManyToOne(() => UserModel, (user) => user.boards)
  @JoinColumn({ name: 'writer_seq', referencedColumnName: 'seq' })
  user: UserModel;
}
