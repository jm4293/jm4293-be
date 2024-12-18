import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ChattingRepository } from '~/database/repository';

@WebSocketGateway(8081, { namespace: 'socket/chatting', transports: ['websocket'] })
export class ChattingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChattingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chattingRepository: ChattingRepository,
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
  ) {}

  private connectedClients: Socket[] = [];

  async afterInit(server: Server) {
    console.log('socket server init', server);
    await this.cacheService.set('test', '11111232fdffsgfdgfdgf');
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    const accessToken = Object.fromEntries(
      client.handshake.headers.cookie.split('; ').map((cookie) => cookie.split('=')),
    )['accessToken'];

    try {
      const verifiedAccessToken = this.jwtService.verify(accessToken);

      // jwt 검증을 통한 인증 작업 로직 시작

      client.data.userSeq = verifiedAccessToken['userSeq'];
      client.data.email = verifiedAccessToken['email'];
      client.data.name = verifiedAccessToken['name'];

      const socketId = client.id;
      console.log('클라이언트가 연결되었습니다:', socketId, verifiedAccessToken);
      this.addClient(socketId);
    } catch (error) {
      this.logger.error(`${client.id} 연결 강제 종료, status: 401, 토큰이 유효하지 않습니다.`);
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    console.log('클라이언트가 연결을 종료했습니다:', client.id);

    const socketId = client.id;
    this.removeClient(socketId);

    this.server.emit(`disconnected socket: ${client.id}`);
  }

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() message: string, @ConnectedSocket() client: Socket) {
    const getTest = await this.cacheService.get('test');

    console.log(
      `유저 정보: ${client.data.userSeq} | ${client.data.email} | ${client.data.name} / 받은 메시지: ${message} | getTest: ${getTest}`,
    );

    await this.chattingRepository.createChatting(client.data.userSeq, { content: message });

    client.broadcast.emit('message', { message, name: client.data.name });
  }

  private addClient(client: any) {
    this.connectedClients.push(client);
  }

  private removeClient(client: any) {
    const index = this.connectedClients.indexOf(client);

    if (index !== -1) {
      this.connectedClients.splice(index, 1);
    }
  }
}
