import test from 'node:test';
import assert from 'node:assert/strict';
import { graduationOnline } from '../frontend/src/pages/academic/student-affairs/graduation.js';
import { onlinePlan } from '../frontend/src/features/curriculum/progress-panel.js';
import { resourceQuery } from '../frontend/src/services/resource-pages.js';
import { navigation } from '../frontend/src/app/navigation.js';

test('V06.11 giao diện: đúng route, các quyết định được escape trước khi render',()=>{
    const malicious='<img src=x onerror=alert(1)>';
    const mock={graduationStudentId:9,db:{students:[{id:9,name:malicious,code:'SV09'}]},
        remoteCurriculumProgress:{state:'ready',data:{student:{code:'SV09',name:malicious},
            program:{name:'Chương trình'},earnedCredits:3,requiredCredits:3,
            requiredOutstanding:0,unmetElectives:0,readyForManualReview:true}},
        remoteRecognitionCandidates:{state:'ready',data:{sources:[{id:1}],targets:[{id:2}]}},
        remoteCreditRecognitions:{state:'ready',data:{records:[{id:12,decisionNumber:malicious,
            sourceCode:'A',targetCode:'B',decisionDate:'2026-11-08',revokedAt:null}]}},
        remoteGraduationReviews:{state:'ready',data:{records:[{id:7,createdAt:'2026-11-08',status:'draft',
            reviewNote:malicious}]}}};
    const html=graduationOnline(mock,'');
    assert.ok(!html.includes(malicious));
    assert.match(html,/&lt;img/);
    assert.match(html,/data-action="graduation-review-approve"/);
    assert.match(html,/data-action="recognition-revoke"/);
    assert.match(html,/data-action="recognition-create"/);
    assert.ok(!html.includes('data-action="graduation-review-create"'),'Không lập bản nháp mới khi đang có một hồ sơ xử lý');
    assert.ok(navigation.academic.some(([key])=>key==='graduation'));
    assert.equal(resourceQuery('graduation-reviews',{studentId:9},{}),'/graduation-reviews?studentId=9');
    assert.equal(resourceQuery('credit-recognitions',{studentId:9},{}),'/credit-recognitions?studentId=9');
    assert.equal(resourceQuery('curriculum-versions',{curriculumId:4},{}),'/curriculum-versions?curriculumId=4');
    const progress=onlinePlan({program:{name:'CTĐT',code:'CT',majorName:'A',admissionYear:2024},
        subjects:[{name:'Môn được công nhận',code:'A1',credits:3,requirementType:'required',
            recommendedSemester:1,learningStatus:'passed',recognitionDecision:malicious,prerequisites:[]}],
        electiveGroups:[],earnedCredits:3,requiredCredits:3,remainingCredits:0,requiredOutstanding:0,
        unmetElectives:0,needsCreditReview:false,unrecognizedSubjects:[],readyForManualReview:true,
        note:'Không phải quyết định tốt nghiệp'});
    assert.ok(!progress.includes(malicious));
    assert.match(progress,/Công nhận tương đương/);
});
