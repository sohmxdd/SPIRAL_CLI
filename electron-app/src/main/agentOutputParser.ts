export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error'

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
  currentPhase: string
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

  public reset(): void {
    this.currentPlan = {
      title: 'Agent is planning',
      isAgentMode: false,
      currentPhase: 'idle',
      steps: []
    }
    this.stepMap.clear()
  }

  public parseChunk(chunk: string): ParsedPlanState {
    const clean = chunk.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    const lines = clean.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Detect Intent / Mode
      if (trimmed.includes('Analyzing intent') || trimmed.includes('[INTENT]')) {
        this.currentPlan.isAgentMode = true
        this.currentPlan.title = 'Analyzing Intent'
        this.addOrUpdateStep('intent', 'Analyze user intent and target constraints', 'active', 'IntentAnalyzer')
      } else if (trimmed.includes('[CHAT]')) {
        this.currentPlan.isAgentMode = false
        this.currentPlan.title = 'Conversational Response'
      }

      // Detect Planning Phase
      if (trimmed.includes('Generating plan') || trimmed.includes('nyx.planning') || trimmed.includes('[PLAN]')) {
        this.currentPlan.isAgentMode = true
        this.currentPlan.title = 'Generating Execution Plan'
        this.markPreviousStepsSuccess()
        this.addOrUpdateStep('plan', 'Generate execution plan with workspace context', 'active', 'PlannerAgent')
      }

      // Detect Step Indicator: Step X/Y: description
      const stepMatch = trimmed.match(/Step\s+(\d+)\/(\d+):\s*(.+)/i) || trimmed.match(/╭─\s*Step\s+(\d+)\/(\d+):\s*(.+)/i)
      if (stepMatch) {
        const stepNum = stepMatch[1]
        const totalSteps = stepMatch[2]
        const description = stepMatch[3].trim()

        this.currentPlan.isAgentMode = true
        this.currentPlan.title = `Executing Plan (Step ${stepNum} of ${totalSteps})`
        this.markPreviousStepsSuccess()

        this.addOrUpdateStep(
          `step-${stepNum}`,
          `Step ${stepNum}: ${description}`,
          'active',
          'CoderAgent'
        )
      }

      // Detect Testing Phase
      if (trimmed.includes('[TEST]') || trimmed.includes('Running test') || trimmed.includes('TesterAgent')) {
        this.addOrUpdateStep('test', 'Generate & run verification tests', 'active', 'TesterAgent')
      }

      // Detect Verification Phase
      if (trimmed.includes('[VERIFY]') || trimmed.includes('VerifierAgent')) {
        this.addOrUpdateStep('verify', 'Verify code correctness & invariants', 'active', 'VerifierAgent')
      }

      // Detect Debug Cycle
      if (trimmed.includes('[DEBUG]') || trimmed.includes('DebuggerAgent') || trimmed.includes('error_detected') || trimmed.includes('[FILE_ERROR]')) {
        const activeStepId = Array.from(this.stepMap.keys()).pop()
        if (activeStepId) {
          const current = this.stepMap.get(activeStepId)!
          current.status = 'error'
        }
        this.addOrUpdateStep('debug', 'Analyze error and apply bugfix cycle', 'active', 'DebuggerAgent', trimmed)
      }

      // Detect Reflection
      if (trimmed.includes('[REFLECT]') || trimmed.includes('ReflectorAgent')) {
        this.addOrUpdateStep('reflect', 'Synthesize execution learnings', 'active', 'ReflectorAgent')
      }

      // Detect Task Completion
      if (trimmed.includes('Task complete') || trimmed.includes('task_complete')) {
        this.markAllStepsSuccess()
        this.currentPlan.title = 'Task Completed Successfully'
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
    if (this.stepMap.has(id)) {
      const step = this.stepMap.get(id)!
      step.status = status
      if (content) step.content = (step.content ? step.content + '\n' : '') + content
    } else {
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
    for (const step of this.stepMap.values()) {
      if (step.status === 'active') {
        step.status = 'success'
      }
    }
  }

  private markAllStepsSuccess(): void {
    for (const step of this.stepMap.values()) {
      if (step.status !== 'error') {
        step.status = 'success'
      }
    }
  }
}
