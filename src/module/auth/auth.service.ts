import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '~/database/repository/user';
import {
  AuthChangePasswordRequestDto,
  AuthFindEmailRequestDto,
  AuthSignInRequestDto,
  AuthSignUpRequestDto,
  AuthVerifyIdRequestDto,
} from '~/module/auth/request';

import * as bcrypt from 'bcrypt';
import { AuthResponseDto } from '~/module/auth/response';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(body: AuthSignInRequestDto, res: Response) {
    const { email, password } = body;

    const user = await this.userRepository.findUserByEmail(email);

    if (!user) {
      throw AuthResponseDto.Fail('일치하는 사용자가 없습니다.');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw AuthResponseDto.Fail('비밀번호가 일치하지 않습니다.');
    }

    const accessToken = await this.generateToken({ user_seq: user.seq, email: user.email, name: user.name }, '15m');
    const refreshToken = await this.generateToken({ user_seq: user.seq, email: user.email, name: user.name }, '1d');

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 1000 * 15,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 1000 * 60 * 24,
    });

    // res.setHeader('Authorization', `Bearer ${accessToken}`);

    const responseData = { email: user.email, name: user.name };

    return res.send(AuthResponseDto.Success('로그인 성공', responseData));
  }

  async signUp(body: AuthSignUpRequestDto) {
    const { name, email, password } = body;

    const isExistName = await this.userRepository.findUserByName(name);

    if (isExistName) {
      throw AuthResponseDto.Fail('이미 존재하는 이름입니다.');
    }

    const isExistEmail = await this.userRepository.findUserByEmail(email);

    if (isExistEmail) {
      throw AuthResponseDto.Fail('이미 존재하는 이메일입니다.');
    }

    const hashSalt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, hashSalt);

    const result = await this.userRepository.createUser({ ...body, password: hashPassword });

    const responseData = { email: result.email, name: result.name };

    return AuthResponseDto.Success('회원가입 성공', responseData);
  }

  async authId(body: AuthVerifyIdRequestDto) {
    const { email, name } = body;

    const user = await this.userRepository.findUserByEmail(email);

    if (!user) {
      throw AuthResponseDto.Fail('일치하는 사용자가 없습니다.');
    }

    if (user.name !== name) {
      throw AuthResponseDto.Fail('일치하는 사용자가 없습니다.');
    }

    return AuthResponseDto.Success('인증 성공');
  }

  async changePassword(body: AuthChangePasswordRequestDto) {
    const { email, password } = body;

    const user = await this.userRepository.findUserByEmail(email);

    if (!user) {
      throw AuthResponseDto.Fail('일치하는 사용자가 없습니다.');
    }

    const hashSalt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, hashSalt);

    await this.userRepository.changePassword({ email, password: hashPassword });

    const responseData = { email: user.email, name: user.name };

    return AuthResponseDto.Success('비밀번호 변경 완료', responseData);
  }

  async findEmail(body: AuthFindEmailRequestDto) {
    const { name } = body;

    const user = await this.userRepository.findUserByName(name);

    if (!user) {
      throw AuthResponseDto.Fail('일치하는 사용자가 없습니다.');
    }

    const responseData = { name: name, email: user.email };

    return AuthResponseDto.Success('이메일 찾기 성공', responseData);
  }

  async renewRefreshToken(refreshToken: string, res: Response) {
    const payload = this.jwtService.verify(refreshToken);

    const accessToken = await this.generateToken(
      { user_seq: payload.user_seq, email: payload.email, name: payload.name },
      '15m',
    );

    res.setHeader('Authorization', `Bearer ${accessToken}`);

    return res.send(AuthResponseDto.Success('토큰 재발급 성공'));
  }

  private async generateToken(payload: { user_seq: number; email: string; name: string }, expiresIn: string) {
    return this.jwtService.sign(payload, { expiresIn });
  }
}
