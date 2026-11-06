import { moduleRegistry } from '@/core'
import { ProjectsModule } from '@/modules/projects/module'
import { WorkspacesModule } from '@/modules/workspaces/module'
import { ReviewModule } from '@/modules/review/module'
import { RunsModule } from '@/modules/runs/module'
import { SettingsModule } from '@/modules/settings/module'
import { OnboardingModule } from '@/modules/onboarding/module'

export async function bootstrap(): Promise<void> {
  moduleRegistry.register(ProjectsModule)
  moduleRegistry.register(WorkspacesModule)
  moduleRegistry.register(ReviewModule)
  moduleRegistry.register(RunsModule)
  moduleRegistry.register(SettingsModule)
  moduleRegistry.register(OnboardingModule)
  await moduleRegistry.bootstrap()
}
