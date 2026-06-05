import { http } from "@/utils/http";

type Result<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
};

export type SystemInfo = {
  firmware: { manufacturer: string; name: string; version: string };
  baseboard: { manufacturer: string; model: string; version: string };
  os: string;
  family: string;
  version: string;
  arch: string;
  uptime: string;
  processCount: number;
  threadCount: number;
};

export type CpuInfo = {
  name: string;
  vendor: string;
  physicalCores: number;
  logicalCores: number;
  maxFreq: string;
  currentFreq: string;
  systemLoad: string;
  loadAverage: string;
};

export type MemoryInfo = {
  physical: {
    total: string;
    available: string;
    used: string;
    usage: string;
  };
  virtual?: { swapTotal: string; swapUsed: string };
};

export type DiskInfo = {
  partitions: Array<{
    name: string;
    mount: string;
    type: string;
    total: string;
    free: string;
    usage: string;
  }>;
};

export type NetworkInfo = {
  hostName: string;
  domainName: string;
  dns: string;
  interfaces: Array<{
    name: string;
    displayName: string;
    ipv4: string;
    ipv6: string;
    mac: string;
    bytesRecv: string;
    bytesSent: string;
    speed: string;
  }>;
};

export type SensorInfo = {
  cpuTemperature: string;
  fanSpeeds: number[];
  cpuVoltage: string;
};

export type JvmInfo = {
  heapUsed: string;
  heapMax: string;
  heapPercent: number;
  threads: number;
  uptime: string;
};

export type DatabaseInfo = {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxPoolSize: number;
  minIdle: number;
};

export type RedisInfo = {
  usedMemory: string;
  connectedClients: string;
  uptimeInDays: string;
  redisVersion: string;
  dbSize: number;
};

export type ProcessInfo = {
  processCount: number;
  threadCount: number;
  topProcesses: Array<{
    pid: number;
    name: string;
    cpu: string;
    memory: string;
    user: string;
    startTime: number;
  }>;
};

export type MonitorData = {
  system: SystemInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  network: NetworkInfo;
  sensor: SensorInfo;
  jvm: JvmInfo;
  database: DatabaseInfo;
  redis: RedisInfo;
  process: ProcessInfo;
};

export const getMonitorData = () => {
  return http.request<Result<MonitorData>>("get", "/api/management/monitor", {
    timeout: 30000
  });
};

export const clearMonitorCache = () => {
  return http.request<Result<string>>(
    "get",
    "/api/management/monitor/cache/clear"
  );
};
