import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { summaryTable,warningTable } from '../frontend/src/features/assessment/summary-tables.js';
import { navigation } from '../frontend/src/app/navigation.js';
import { semesterResults } from '../frontend/src/pages/academic/assessment/semester-results.js';

// HTML is rendered from backend fields: always escape text even when a teacher edits a name.
test('V06.9 UI: đường dẫn tài nguyên riêng, phân quyền theo menu và thoát HTML',()=>{
    assert.equal(resourceQuery('academic-semesters',{},{}),'/academic-semesters');
    assert.equal(resourceQuery('semester-summaries',{studentId:'2'},{}),'/semester-summaries?studentId=2');
    assert.equal(resourceQuery('academic-warnings',{studentId:'2'},{}),'/academic-warnings?studentId=2');
    assert.equal(resourceQuery('summary-preview',{studentId:'2',semesterId:'3'},{}),'/semester-summaries/preview?studentId=2&semesterId=3');
    assert.ok(navigation.academic.some(([key])=>key==='semester'));
    assert.ok(!navigation.student.some(([key])=>key==='semester'));
    const html=summaryTable([{id:'1',semesterName:'<svg/onload=alert(1)>',revision:1,policyCode:'DEMO',demo:true,
        earnedCredits:3,attemptedCredits:5,cumulativeEarnedCredits:3,semesterGpa:2.5,cumulativeGpa:3,
        status:'approved',isCurrent:true}],'student');
    assert.ok(!html.includes('<svg/onload'));
    assert.match(html,/&lt;svg/);
    assert.match(html,/Minh họa/);
    assert.ok(!html.includes('data-action="summary-approve"'));
    const warnings=warningTable([{id:'1',semesterName:'HK I',reason:'<img src=x onerror=alert(1)>',level:1,
        consecutiveCount:1,decisionNumber:'QĐ-1',status:'approved'}],'student');
    assert.ok(!warnings.includes('<img src=x'));
    assert.match(warnings,/&lt;img/);
    assert.ok(!warnings.includes('warning-revoke'));
    const offline=semesterResults({db:{students:[]},user:{role:'academic'},filters:{}});
    assert.match(offline,/Cần chạy backend/);
});
