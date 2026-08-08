export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error'
export type AgentPlanLifecycle = 'idle' | 'active' | 'complete' | 'error'

export interface ParsedStep {
  id: string
  title: string
  status: PlanStepStatus
  subagent: 'PlannerAgent' | 'CoderAgent' | 'TesterAgent' | 'VerifierAgent' | 'DebuggerAgent' | 'ReflectorAgent' | 'IntentAnalyzer' | 'General'
  duration?: string
  content?: string
  defaultExpanded?: boolean
}

export interface ParsedPlanState {
  title: string
  isAgentMode: boolean
  currentPhase: AgentPlanLifecycle
  activeSkill?: string
  steps: ParsedStep[]
}

export class AgentOutputParser {
  private currentPlan: ParsedPlanState = {
    title: 'Agent is planning',
    isAgentMode: false,
    currentPhase: 'idle',
    steps: []
  }

  private stepMap: Map<string, ParsedStep> = new Map()
  private stepStartTimes: Map<string, number> = new Map()

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  public reset(): void {
    this.currentPlan = {
      title: 'Agent is planning',
      isAgentMode: false,
      currentPhase: 'idle',
      steps: []
    }
    this.stepMap.clear()
    this.stepStartTimes.clear()
  }

  public parseChunk(chunk: string): ParsedPlanState {
    const clean = chunk.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    const lines = clean.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Detect Skill Activation Marker: [SKILL_ACTIVE: name]
      const skillMatch = trimmed.match(/\[SKILL_ACTIVE:\s*(.+)\]/i)
      if (skillMatch) {
        const skillName = skillMatch[1].trim()
        this.currentPlan.activeSkill = skillName
        this.addOrUpdateStep(
          `skill-${skillName}`,
          `Activated Skill: ${skillName}`,
          'success',
          'General'
        )
        continue
      }

      // Detect Intent / Mode
      if (trimmed.includes('Analyzing intent') || trimmed.includes('[INTENT]')) {
        this.currentPlan.isAgentMode = true
        this.currentPlan.currentPhase = 'active'
        this.currentPlan.title = 'Analyzing Intent'
        this.addOrUpdateStep('intent', 'Analyze user intent and target constraints', 'active', 'IntentAnalyzer')
        continue
      } else if (trimmed.includes('[CHAT]')) {
        this.currentPlan.isAgentMode = false
        this.currentPlan.title = 'Conversational Response'
      }

      // Detect Planning Phase
      if (trimmed.includes('Generating plan') || trimmed.includes('nyx.planning') || trimmed.includes('[PLAN]')) {
        this.currentPlan.isAgentMode = true
        this.currentPlan.currentPhase = 'active'
        this.currentPlan.title = 'Generating Execution Plan'
        this.markPreviousStepsSuccess()
        this.addOrUpdateStep('plan', 'Generate execution plan with workspace context', 'active', 'PlannerAgent')
        continue
      }

      // Detect Step Indicator: Step X/Y: description
      const stepMatch = trimmed.match(/Step\s+(\d+)\/(\d+):\s*(.+)/i) || trimmed.match(/╭─\s*Step\s+(\d+)\/(\d+):\s*(.+)/i)
      if (stepMatch) {
        const stepNum = stepMatch[1]
        const totalSteps = stepMatch[2]
        const description = stepMatch[3].trim()

        this.currentPlan.isAgentMode = true
        this.currentPlan.currentPhase = 'active'
        this.currentPlan.title = `Executing Plan (Step ${stepNum} of ${totalSteps})`
        this.markPreviousStepsSuccess()

        this.addOrUpdateStep(
          `step-${stepNum}`,
          `Step ${stepNum}: ${description}`,
          'active',
          'CoderAgent'
        )
        continue
      }

      // Detect Testing Phase
      if (trimmed.includes('[TEST]') || trimmed.includes('Running test') || trimmed.includes('TesterAgent')) {
        this.currentPlan.currentPhase = 'active'
        this.addOrUpdateStep('test', 'Generate & run verification tests', 'active', 'TesterAgent')
        continue
      }

      // Detect Verification Phase
      if (trimmed.includes('[VERIFY]') || trimmed.includes('VerifierAgent')) {
        this.currentPlan.currentPhase = 'active'
        this.addOrUpdateStep('verify', 'Verify code correctness & invariants', 'active', 'VerifierAgent')
        continue
      }

      // Detect Debug Cycle
      if (trimmed.includes('[DEBUG]') || trimmed.includes('DebuggerAgent') || trimmed.includes('error_detected') || trimmed.includes('[FILE_ERROR]')) {
        this.currentPlan.currentPhase = 'active'
        const activeStepId = Array.from(this.stepMap.keys()).pop()
        if (activeStepId) {
          const current = this.stepMap.get(activeStepId)!
          current.status = 'error'
        }
        this.addOrUpdateStep('debug', 'Analyze error and apply bugfix cycle', 'active', 'DebuggerAgent', trimmed)
        continue
      }

      // Detect Reflection
      if (trimmed.includes('[REFLECT]') || trimmed.includes('ReflectorAgent')) {
        this.currentPlan.currentPhase = 'active'
        this.addOrUpdateStep('reflect', 'Synthesize execution learnings', 'active', 'ReflectorAgent')
        continue
      }

      // Detect Task Completion / Final Answer Stream Start
      if (trimmed.includes('Task complete') || trimmed.includes('task_complete')) {
        this.markAllStepsSuccess()
        this.currentPlan.currentPhase = 'complete'
        this.currentPlan.title =
          this.stepMap.size > 0
            ? `Thought for ${this.stepMap.size} step${this.stepMap.size === 1 ? '' : 's'}`
            : 'Thought process completed'
        continue
      }

      // If we have active steps and non-status, non-banner assistant text starts streaming,
      // transition state machine to 'complete' and mark pending/active steps as success.
      if (
        this.currentPlan.currentPhase === 'active' &&
        this.stepMap.size > 0 &&
        !trimmed.startsWith('██') &&
        !trimmed.startsWith('╭') &&
        !trimmed.startsWith('╰') &&
        !trimmed.startsWith('│') &&
        !trimmed.includes('(spiral)')
      ) {
        this.markAllStepsSuccess()
        this.currentPlan.currentPhase = 'complete'
        this.currentPlan.title =
          this.stepMap.size > 0
            ? `Thought for ${this.stepMap.size} step${this.stepMap.size === 1 ? '' : 's'}`
            : 'Thought process completed'
      }
    }

    this.currentPlan.steps = Array.from(this.stepMap.values())
    return this.currentPlan
  }

  private addOrUpdateStep(
    id: string,
    title: string,
    status: PlanStepStatus,
    subagent: ParsedStep['subagent'],
    content?: string
  ): void {
    const now = Date.now()
    if (this.stepMap.has(id)) {
      const step = this.stepMap.get(id)!
      const prevStatus = step.status
      step.status = status
      if (content) step.content = (step.content ? step.content + '\n' : '') + content
      if (prevStatus === 'active' && (status === 'success' || status === 'error')) {
        const start = this.stepStartTimes.get(id) || now
        step.duration = this.formatDuration(now - start)
      }
    } else {
      this.stepStartTimes.set(id, now)
      this.stepMap.set(id, {
        id,
        title,
        status,
        subagent,
        content
      })
    }
  }

  private markPreviousStepsSuccess(): void {
    const now = Date.now()
    for (const [id, step] of this.stepMap.entries()) {
      if (step.status === 'active') {
        step.status = 'success'
        const start = this.stepStartTimes.get(id) || now
        step.duration = this.formatDuration(now - start)
      }
    }
  }

  public markAllStepsSuccess(): void {
    const now = Date.now()
    for (const [id, step] of this.stepMap.entries()) {
      if (step.status !== 'error') {
        step.status = 'success'
        if (!step.duration) {
          const start = this.stepStartTimes.get(id) || now
          step.duration = this.formatDuration(now - start)
        }
      }
    }
  }

  public markError(): void {
    const now = Date.now()
    this.currentPlan.currentPhase = 'error'
    for (const [id, step] of this.stepMap.entries()) {
      if (step.status === 'active') {
        step.status = 'error'
        const start = this.stepStartTimes.get(id) || now
        step.duration = this.formatDuration(now - start)
      }
    }
  }
}
