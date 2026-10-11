export type AgentGroupId =
  | "engineering"
  | "data"
  | "product"
  | "design"
  | "ops"
  | "qa"
  | "leadership";

export type AgentId = string;

export type Agent = {
  id: AgentId;
  name: string;
  title: string;
  group: AgentGroupId;
  summary: string;
  focus: string[];
  outputs: string[];
  talksTo: AgentId[];
  core?: boolean;
};

export type AgentGroup = {
  id: AgentGroupId;
  label: string;
};

export type BoardItemStatus = "backlog" | "doing" | "review" | "done";

export type PipelineStage = "brief" | "plan" | "code" | "test" | "report";

export type BoardItem = {
  id: string;
  title: string;
  status: BoardItemStatus;
  ownerId: AgentId;
  note: string;
  projectId: string;
  pipelineStage?: PipelineStage;
  fromAgentId?: AgentId;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  at: string;
  meta?: {
    handoffTo?: AgentId;
    boardItemIds?: string[];
    approvalId?: string;
  };
};

export type Project = {
  id: string;
  name: string;
  company: string;
  cwd: string;
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Approval = {
  id: string;
  status: ApprovalStatus;
  reason: string;
  action: string;
  agentId: AgentId;
  projectId: string;
  createdAt: string;
};

export type AppState = {
  version: 1;
  activeProjectId: string;
  projects: Project[];
  board: BoardItem[];
  threads: Record<string, ChatMessage[]>;
  pins: AgentId[];
  approvals: Approval[];
};

export type AgentActionPayload = {
  board?: {
    op: "upsert" | "move";
    id?: string;
    title?: string;
    status?: BoardItemStatus;
    note?: string;
    ownerId?: AgentId;
    pipelineStage?: PipelineStage;
  }[];
  handoff?: { agentId: AgentId; brief: string };
  needsApproval?: { reason: string; action: string };
};
