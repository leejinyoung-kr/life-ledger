import { Injectable } from '@nestjs/common';
import { MetaContributor } from '@leejinyoun/core-common';
import type { MetaSection } from '@leejinyoun/core-common';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';

// /_meta 의 notification 구역 — 어떤 발송 수단이 실제로 켜져 있는지.
// VAPID·SMTP 를 비우면 그 채널이 꺼지는 것이 의도된 설정이라, 꺼져 있어도 경고하지 않고 사실만 보여준다
@Injectable()
export class NotificationMetaContributor extends MetaContributor {
  readonly key = 'notification';

  constructor(
    private mail: MailService,
    private push: PushService,
  ) {
    super();
  }

  collect(): MetaSection {
    const { webPush, outboxChannels } = this.push.status();
    return { mail: this.mail.isEnabled, webPush, outboxChannels };
  }
}
