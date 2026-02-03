import {
  BehaviorFactory,
  BehaviorType
} from './base-behavior';
import { 
  ReadBehavior, 
  ThinkBehavior, 
  PostBehavior, 
  ReplyBehavior, 
  IdleBehavior 
} from './default-behaviors';

export class ReadBehaviorFactory implements BehaviorFactory<ReadBehavior> {
  readonly type: BehaviorType = 'read';

  create(config: any): ReadBehavior {
    return new ReadBehavior(config);
  }
}

export class ThinkBehaviorFactory implements BehaviorFactory<ThinkBehavior> {
  readonly type: BehaviorType = 'think';

  create(config: any): ThinkBehavior {
    return new ThinkBehavior(config);
  }
}

export class PostBehaviorFactory implements BehaviorFactory<PostBehavior> {
  readonly type: BehaviorType = 'post';

  create(config: any): PostBehavior {
    return new PostBehavior(config);
  }
}

export class ReplyBehaviorFactory implements BehaviorFactory<ReplyBehavior> {
  readonly type: BehaviorType = 'reply';

  create(config: any): ReplyBehavior {
    return new ReplyBehavior(config);
  }
}

export class IdleBehaviorFactory implements BehaviorFactory<IdleBehavior> {
  readonly type: BehaviorType = 'idle';

  create(config: any): IdleBehavior {
    return new IdleBehavior(config);
  }
}

export const registerDefaultFactories = (registry: any) => {
  registry.registerFactory(new ReadBehaviorFactory());
  registry.registerFactory(new ThinkBehaviorFactory());
  registry.registerFactory(new PostBehaviorFactory());
  registry.registerFactory(new ReplyBehaviorFactory());
  registry.registerFactory(new IdleBehaviorFactory());
};