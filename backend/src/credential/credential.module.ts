import { Module } from '@nestjs/common';
import { CredentialController } from './credential.controller';
import { CredentialService } from './credential.service';

@Module({
  controllers: [CredentialController],
  providers: [CredentialService],
})
export class CredentialModule {}
