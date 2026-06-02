import { Module } from '@nestjs/common';
import { GoalController } from './goal.controller';
import { GoalService } from './goal.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

// 할일/목표 페이지의 두 리소스(tasks/goals)를 한 모듈로 묶는다.
@Module({
  controllers: [TaskController, GoalController],
  providers: [TaskService, GoalService],
})
export class TaskModule {}
