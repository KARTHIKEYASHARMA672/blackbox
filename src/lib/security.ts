import type { Advisory, CodeFile, Finding, Severity } from './types';
import { SEVERITY_ORDER, SEVERITY_WEIGHT, uid } from './util';

interface Rule {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  remediation: string;
  pattern: RegExp;
  languages?: RegExp; // optional file-extension filter
  excludeLine?: RegExp; // skip obvious placeholders / examples
}

const PLACEHOLDER = /(example|placeholder|changeme|change_me|your[_-]?(api[_-]?)?key|xxx+|dummy|sample|test[_-]?key|fake|not[_-]?real|<[^>]*>)/i;

const RULES: Rule[] = [
  {
    id: 'SEC-001', title: 'AWS Access Key ID exposed', severity: 'critical', category: 'Secrets',
    description: 'An AWS access key ID pattern was found in source. Keys leaked in code are scraped by bots within minutes.',
    remediation: 'Revoke the key immediately in IAM, purge it from git history, and use environment variables or a secrets manager (AWS Secrets Manager / Vault).',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'SEC-002', title: 'Private key material committed', severity: 'critical', category: 'Secrets',
    description: 'A PEM/OpenSSH private key block was found in the repository.',
    remediation: 'Treat the key as compromised: rotate it, remove it from history, and load keys from a secrets manager or mounted volume at runtime.',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    id: 'SEC-003', title: 'GitHub token in source', severity: 'critical', category: 'Secrets',
    description: 'A GitHub personal access / OAuth / refresh token was committed to the codebase.',
    remediation: 'Revoke the token on GitHub immediately and re-issue with minimum scopes. Store it as a repository secret or environment variable.',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  },
  {
    id: 'SEC-004', title: 'Google API key in source', severity: 'high', category: 'Secrets',
    description: 'A Google API key (AIza…) appears in source. Unlike OAuth secrets these are unrestricted by default.',
    remediation: 'Restrict the key by HTTP referrer / IP + API in Google Cloud Console, rotate it, and move it to environment configuration.',
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/,
  },
  {
    id: 'SEC-005', title: 'Slack token in source', severity: 'high', category: 'Secrets',
    description: 'A Slack bot/app/user token was found in the codebase.',
    remediation: 'Revoke the token in the Slack app console, re-install with minimal scopes, and store the token in a secrets manager.',
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: 'SEC-006', title: 'Stripe live secret key committed', severity: 'critical', category: 'Secrets',
    description: 'A Stripe live secret key (sk_live_…) is present in the repository. This grants full access to the Stripe account.',
    remediation: 'Roll the key immediately in the Stripe Dashboard, remove it from git history, and use server-side environment variables only.',
    pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/,
  },
  {
    id: 'SEC-007', title: 'Hardcoded credential in source', severity: 'high', category: 'Secrets',
    description: 'A variable that looks like an API key/password/token is assigned a long literal string. Hardcoded credentials survive in git history forever.',
    remediation: 'Move the value to an environment variable or secrets manager. Purge from history (git filter-repo) and rotate the credential.',
    pattern: /[A-Za-z0-9_-]*(?:api[-_]?key|apikey|secret|passwd|password|auth[-_]?token|access[-_]?token|client[-_]?secret|private[-_]?key)[A-Za-z0-9_-]*\s*[:=]\s*['"]([^'"\s]{10,})['"]/i,
    excludeLine: PLACEHOLDER,
  },
  {
    id: 'SEC-008', title: 'JSON Web Token embedded in source', severity: 'medium', category: 'Secrets',
    description: 'A JWT literal was found in source. It may encode live session data or claims.',
    remediation: 'Verify whether the token is still valid and revoke/rotate it. Never embed real tokens in source or fixtures.',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/,
  },
  {
    id: 'SEC-009', title: 'eval() usage', severity: 'high', category: 'Code Injection',
    description: 'eval() executes arbitrary strings as code. If any part of the evaluated input is attacker-controlled, this is RCE.',
    remediation: 'Replace eval with JSON.parse for data, explicit dispatch tables for logic, or a sandboxed interpreter. Never eval user input.',
    pattern: /\beval\s*\(/,
    excludeLine: /^\s*(\/\/|#|\*)/,
  },
  {
    id: 'SEC-010', title: 'new Function() constructor', severity: 'medium', category: 'Code Injection',
    description: 'new Function(…) compiles strings into functions — equivalent to eval for injection purposes.',
    remediation: 'Refactor to static functions or a lookup table. If dynamic code is unavoidable, isolate it in a hardened sandbox.',
    pattern: /\bnew\s+Function\s*\(/,
  },
  {
    id: 'SEC-011', title: 'innerHTML assignment (XSS risk)', severity: 'medium', category: 'XSS',
    description: 'Direct innerHTML assignment with interpolated data is a classic DOM XSS sink.',
    remediation: 'Use textContent, or a sanitizer (DOMPurify) with a strict allow-list before injecting HTML. Prefer framework-escaped rendering.',
    pattern: /\.innerHTML\s*(\+)?=(?!=)/,
  },
  {
    id: 'SEC-012', title: 'dangerouslySetInnerHTML usage', severity: 'low', category: 'XSS',
    description: 'React bypasses its escaping when dangerouslySetInnerHTML is used. Safe only with sanitized input.',
    remediation: 'Sanitize with DOMPurify before rendering, or render plain text. Document why raw HTML is required.',
    pattern: /dangerouslySetInnerHTML/,
  },
  {
    id: 'SEC-013', title: 'document.write() usage', severity: 'low', category: 'XSS',
    description: 'document.write writes raw HTML into the document — an XSS sink and a performance footgun.',
    remediation: 'Use DOM APIs (createElement/textContent) or framework rendering instead.',
    pattern: /\bdocument\.write(ln)?\s*\(/,
  },
  {
    id: 'SEC-014', title: 'SQL query built with string interpolation', severity: 'high', category: 'Injection',
    description: 'A SQL statement string contains ${…} interpolation or concatenation — the textbook SQL injection pattern.',
    remediation: 'Use parameterized queries / prepared statements (placeholders + bound params) or a query builder / ORM.',
    pattern: /\b(?:execute|query|exec|raw|prepare)\s*\(\s*[`'"][^'"\n]{0,200}(?:\$\{|\+\s*[a-zA-Z_(])/i,
  },
  {
    id: 'SEC-015', title: 'SQL string concatenation', severity: 'medium', category: 'Injection',
    description: 'A quoted SQL-looking literal is concatenated with a variable. If the variable is user-controlled this is SQLi.',
    remediation: 'Parameterize the query or validate/allow-list identifiers explicitly.',
    pattern: /["'](?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)[^"'\n]{0,120}["']\s*\+/i,
  },
  {
    id: 'SEC-016', title: 'TLS certificate verification disabled', severity: 'high', category: 'Transport Security',
    description: 'The code disables TLS certificate validation (rejectUnauthorized:false / verify=False / InsecureSkipVerify). This silently allows MITM attacks.',
    remediation: 'Remove the bypass. Fix the underlying certificate problem (CA bundle, corporate proxy CA) instead of disabling verification.',
    pattern: /(rejectUnauthorized\s*:\s*false|verify\s*=\s*False\b|InsecureSkipVerify\s*:\s*true|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0)/,
  },
  {
    id: 'SEC-017', title: 'Weak hash function (MD5/SHA-1)', severity: 'medium', category: 'Cryptography',
    description: 'MD5/SHA-1 are collision-broken and unsuitable for passwords, signatures or integrity checks.',
    remediation: 'Passwords: bcrypt / scrypt / argon2. Integrity: SHA-256+ / HMAC. Signatures: Ed25519 / ECDSA-P256.',
    pattern: /\b(?:createHash\s*\(\s*['"](?:md5|sha1)['"]|md5\s*\(|sha1\s*\()/i,
  },
  {
    id: 'SEC-018', title: 'Math.random() used as randomness source', severity: 'low', category: 'Cryptography',
    description: 'Math.random() is a non-cryptographic PRNG — tokens/ids derived from it are predictable.',
    remediation: 'Use crypto.randomUUID(), crypto.getRandomValues() (browser) or crypto.randomBytes() (node) for security-sensitive values.',
    pattern: /\bMath\.random\s*\(/,
  },
  {
    id: 'SEC-019', title: 'Shell command with string interpolation', severity: 'high', category: 'Command Injection',
    description: 'exec/execSync with an interpolated string is command injection if any fragment is attacker-controlled.',
    remediation: 'Use execFile/spawn with an argument array (no shell), validate against an allow-list, or avoid the shell entirely.',
    pattern: /\b(?:exec|execSync|execFile|popen|spawn)\s*\(\s*(?:`|['"])[^'"\n]{0,200}(?:\$\{|\+\s*[a-zA-Z_(])/,
  },
  {
    id: 'SEC-020', title: 'Python shell=True', severity: 'medium', category: 'Command Injection',
    description: 'subprocess with shell=True passes the command through /bin/sh — interpolated input becomes injection.',
    remediation: 'Pass a list of args without the shell: subprocess.run(["cmd", arg1, arg2]). Never interpolate user input into shell strings.',
    pattern: /\bshell\s*=\s*True\b/,
  },
  {
    id: 'SEC-021', title: 'os.system() call', severity: 'high', category: 'Command Injection',
    description: 'os.system executes a shell command with no escaping opportunities — direct injection sink.',
    remediation: 'Use subprocess with an argument list and shell=False, or purpose-built libraries.',
    pattern: /\bos\.system\s*\(/,
  },
  {
    id: 'SEC-022', title: 'pickle deserialization', severity: 'medium', category: 'Deserialization',
    description: 'pickle.loads on untrusted data is arbitrary code execution by design.',
    remediation: 'Use JSON/msgpack for untrusted data. If pickle is unavoidable, sign payloads (HMAC) and verify before loading.',
    pattern: /\bpickle\.loads?\s*\(/,
  },
  {
    id: 'SEC-023', title: 'yaml.load without SafeLoader', severity: 'high', category: 'Deserialization',
    description: 'yaml.load defaults to the unsafe Loader in PyYAML < 6 — arbitrary Python object construction from YAML.',
    remediation: 'Use yaml.safe_load() or yaml.load(…, Loader=yaml.SafeLoader) exclusively.',
    pattern: /\byaml\.load\s*\((?![^)\n]*(SafeLoader|safe_load))/,
  },
  {
    id: 'SEC-024', title: 'CORS wildcard origin', severity: 'medium', category: 'Access Control',
    description: 'Access-Control-Allow-Origin: * (or cors() default) lets any website call the API with user cookies if credentials are also allowed.',
    remediation: 'Allow-list explicit origins. Never combine credentials:true with a wildcard origin.',
    pattern: /(Access-Control-Allow-Origin[^\n]{0,40}\*|origin\s*:\s*['"]\*['"])/i,
  },
  {
    id: 'SEC-025', title: 'Debug mode enabled in code', severity: 'medium', category: 'Configuration',
    description: 'DEBUG=True / debug = true leaks stack traces, settings and secrets in error pages.',
    remediation: 'Drive debug from environment (DEBUG=false in prod). Ensure error pages in production reveal no internals.',
    pattern: /\b(?:DEBUG|debug)\s*=\s*(?:True|true|1)\b/,
  },
  {
    id: 'SEC-026', title: 'Cleartext HTTP endpoint hardcoded', severity: 'info', category: 'Transport Security',
    description: 'An http:// (non-TLS) URL is hardcoded. Traffic to it is unencrypted and tamperable.',
    remediation: 'Use https:// everywhere. For internal services, terminate TLS or run mTLS.',
    pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|schemas?\.|www\.w3\.org|xmlns)[a-z0-9.-]+/i,
  },
  {
    id: 'SEC-027', title: 'Target=_blank without rel=noopener', severity: 'low', category: 'Access Control',
    description: 'target="_blank" without rel="noopener noreferrer" lets the new page control window.opener (tabnabbing).',
    remediation: 'Add rel="noopener noreferrer" to all target=_blank links.',
    pattern: /target\s*=\s*["']_blank["'](?![^>]*rel\s*=)/i,
  },
  {
    id: 'SEC-028', title: 'JWT signed with guessable/inline logic', severity: 'low', category: 'Cryptography',
    description: 'jwt.sign with an inline secret literal often indicates a hardcoded signing key.',
    remediation: 'Load the signing key from a secrets manager; set algorithm explicitly and keep keys out of source.',
    pattern: /jwt\.sign\s*\([^)\n]{0,200}['"][A-Za-z0-9_-]{6,}['"]\s*\)/,
    excludeLine: PLACEHOLDER,
  },
];

const SECRET_FILE = /(^|\/)(\.env(\.[a-z0-9_-]+)?|id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i;
const KEY_EXT = /\.(pem|p12|pfx|jks|keystore|key)$/i;

export interface SecurityReport {
  findings: Finding[];
  score: number;
  grade: string;
  riskLabel: string;
  riskColor: string;
}

export function scanSecurity(files: CodeFile[], advisories: Advisory[]): SecurityReport {
  const findings: Finding[] = [];

  // File-level rules (committed secrets & key material)
  for (const f of files) {
    const base = (f.path.split('/').pop() ?? '').toLowerCase();
    if (base === '.env.example' || base === '.env.sample' || base === '.env.template' || base === '.env.defaults') continue;
    if (SECRET_FILE.test(f.path.toLowerCase())) {
      findings.push({
        id: uid('f'), ruleId: 'SEC-000', severity: 'critical', category: 'Secrets',
        title: 'Environment file committed to repository',
        description: `The file "${f.path}" is committed. .env files routinely contain live credentials and are the #1 source of leaked secrets.`,
        remediation: 'Remove it from the repo, add .env* to .gitignore (keep .env.example with keys only), rotate every value it held.',
        file: f.path, line: 1, snippet: base,
      });
      continue;
    }
    if (KEY_EXT.test(f.path)) {
      findings.push({
        id: uid('f'), ruleId: 'SEC-029', severity: 'high', category: 'Secrets',
        title: 'Private key / keystore file committed',
        description: `The file "${f.path}" looks like key material and should never live in a repository.`,
        remediation: 'Remove and rotate the key. Distribute keys via your secrets manager or CI secret store.',
        file: f.path, line: 1, snippet: base,
      });
    }
  }

  // Line-level rules
  for (const f of files) {
    if (!f.content) continue;
    if (f.content.length > 300_000) continue;
    const isCode = /\.(ts|tsx|js|jsx|mjs|cjs|py|java|kt|go|rb|php|cs|c|cpp|h|hpp|rs|swift|scala|sh|ps1|sql|vue|svelte|astro)$/i.test(f.path)
      || /(dockerfile|jenkinsfile|makefile)$/i.test(f.path);
    if (!isCode) continue;
    const lines = f.content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      if (raw.length > 600) continue;
      const trimmed = raw.trim();
      for (const rule of RULES) {
        rule.pattern.lastIndex = 0;
        const m = rule.pattern.exec(raw);
        if (!m) continue;
        if (rule.excludeLine && rule.excludeLine.test(raw)) continue;
        // generic secret rule: skip short/placeholder values
        if (rule.id === 'SEC-007') {
          const value = m[1] ?? '';
          if (PLACEHOLDER.test(value)) continue;
        }
        findings.push({
          id: uid('f'),
          ruleId: rule.id,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          description: rule.description,
          remediation: rule.remediation,
          file: f.path,
          line: i + 1,
          snippet: trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed,
        });
      }
    }
  }

  // Dependency advisories → findings
  for (const adv of advisories) {
    findings.push({
      id: uid('f'),
      ruleId: 'SEC-030',
      severity: adv.severity,
      category: 'Dependencies',
      title: `Vulnerable dependency: ${adv.name}@${adv.version}`,
      description: `${adv.title}. Flagged by BLACKBOX's built-in advisory database (offline heuristic — confirm with npm audit / pip-audit / GitHub Advisory DB).`,
      remediation: adv.fix,
      file: '(dependency manifest)',
      line: 0,
      snippet: `${adv.name}@${adv.version} (${adv.manager})`,
    });
  }

  // Score (monotonic, floor 0)
  let penalty = 0;
  for (const f of findings) penalty += SEVERITY_WEIGHT[f.severity];
  const score = Math.max(0, 100 - penalty);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  const riskLabel = grade === 'A' ? 'Low risk' : grade === 'B' ? 'Guarded' : grade === 'C' ? 'Elevated' : grade === 'D' ? 'High risk' : 'Critical risk';
  const riskColor = grade === 'A' ? '#34f5a5' : grade === 'B' ? '#5eead4' : grade === 'C' ? '#fbbf24' : grade === 'D' ? '#fb923c' : '#fb7185';

  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);

  return { findings, score, grade, riskLabel, riskColor };
}
