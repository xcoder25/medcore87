const fs = require('fs');
const filePath = 'apps/os/src/components/rbac/AccessControl.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Sliders to lucide-react import
if (!code.includes('Sliders,')) {
  code = code.replace(
    "import {\n  Shield, Plus, Search, CheckCircle2, XCircle, Lock, UserPlus, IdCard, Trash2,",
    "import {\n  Shield, Plus, Search, CheckCircle2, XCircle, Lock, UserPlus, IdCard, Trash2, Sliders,"
  );
}

// 2. Import RoleMatrixManager
if (!code.includes("import { RoleMatrixManager }")) {
  code = code.replace(
    "import { DuplicateCardModal } from '../staffing/DuplicateCardModal';",
    "import { DuplicateCardModal } from '../staffing/DuplicateCardModal';\nimport { RoleMatrixManager } from './RoleMatrixManager';"
  );
}

// 3. Update Props initialTab
code = code.replace(
  "initialTab?: 'directory' | 'enrol' | 'cards';",
  "initialTab?: 'directory' | 'enrol' | 'cards' | 'roles';"
);

// 4. Update useState
code = code.replace(
  "const [activeTab, setActiveTab] = useState<'directory' | 'enrol' | 'cards'>(initialTab);",
  "const [activeTab, setActiveTab] = useState<'directory' | 'enrol' | 'cards' | 'roles'>(initialTab);"
);

// 5. Add tab button
const targetButtonBlock = `            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'cards' ? '#0052D4' : 'transparent',
                color: activeTab === 'cards' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'cards' ? '0 4px 12px rgba(0,82,212,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <IdCard size={16} />
              <span>ID Badges</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 999, background: activeTab === 'cards' ? 'rgba(255,255,255,0.25)' : '#E2E8F0', color: activeTab === 'cards' ? '#fff' : '#64748B' }}>
                {countActiveStaffCards(facilityId)}
              </span>
            </button>`;

const newButton = targetButtonBlock + `

            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'roles' ? '#0052D4' : 'transparent',
                color: activeTab === 'roles' ? '#FFFFFF' : '#475569',
                boxShadow: activeTab === 'roles' ? '0 4px 12px rgba(0,82,212,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={16} />
              <span>Role Matrix & Tools</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 999, background: activeTab === 'roles' ? 'rgba(255,255,255,0.25)' : '#F1F5F9', color: activeTab === 'roles' ? '#fff' : '#64748B' }}>
                Studio
              </span>
            </button>`;

if (code.includes(targetButtonBlock)) {
  code = code.replace(targetButtonBlock, newButton);
} else {
  console.error('targetButtonBlock NOT found');
}

// 6. Add Tab 4 content
const tabCardsEnd = `                    <Printer size={13} /> Print Card
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}`;

const newTabContent = tabCardsEnd + `

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: ROLE MATRIX & HOSPITAL TOOLS STUDIO
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'roles' && (
        <RoleMatrixManager
          facilityId={facilityId}
          facilityName={facilityName}
          onRoleCreated={(newKey) => {
            setRoleKey(newKey);
            setActiveTab('enrol');
          }}
        />
      )}`;

if (code.includes(tabCardsEnd)) {
  code = code.replace(tabCardsEnd, newTabContent);
} else {
  console.error('tabCardsEnd NOT found');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated AccessControl.tsx with RoleMatrixManager!');

