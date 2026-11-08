const joins=`
  FROM students s
  JOIN student_groups g ON g.student_group_id=s.student_group_id
  JOIN curricula p ON p.curriculum_id=g.curriculum_id
  JOIN majors m ON m.major_id=p.major_id
  JOIN departments d ON d.department_id=m.department_id`;

export async function searchStudents(db,user,query){
  const predicates=[],args=[];
  const filter=(sql,value)=>{if(value!==null){predicates.push(sql);args.push(value);}};
  filter('p.admission_year=?',query.admissionYear);
  filter('d.department_id=?',query.departmentId);
  filter('m.major_id=?',query.majorId);
  filter('p.curriculum_id=?',query.curriculumId);
  filter('g.student_group_id=?',query.groupId);
  if(query.status)filter('s.status=?',query.status);
  if(query.search){
    const escaped=query.search.replace(/[!%_]/g,'!$&');
    const field=db.driver==='sqlite'?'QLSV_NORMALIZE(s.full_name)':'s.full_name';
    predicates.push(`(s.student_code LIKE ? ESCAPE '!' OR ${field} LIKE ? ESCAPE '!')`);
    args.push('%'+escaped+'%', '%'+(db.driver==='sqlite'?query.normalized:escaped)+'%');
  }
  if(user.role==='STUDENT')filter('s.user_id=?',user.user_id);
  if(user.role==='LECTURER')filter('g.advisor_lecturer_id IN (SELECT lecturer_id FROM lecturers WHERE user_id=?)',user.user_id);
  const where=predicates.length?' WHERE '+predicates.join(' AND '):'';
  const count=await db.get('SELECT COUNT(*) AS total'+joins+where,args);
  const items=await db.all(`
    SELECT s.student_id AS id,s.student_code AS code,s.full_name AS name,s.status,
      (SELECT sp.version FROM student_photos sp WHERE sp.student_id=s.student_id) AS photoVersion,
      g.student_group_id AS groupId,g.name AS class,
      p.curriculum_id AS programId,p.name AS program,p.admission_year AS admissionYear,
      m.major_id AS majorId,m.name AS major,d.name AS department
    ${joins}${where}
    ORDER BY s.student_code LIMIT ? OFFSET ?`,[...args,query.limit,query.offset]);
  return {total:Number(count.total),items:items.map(row=>({...row,id:String(row.id),groupId:String(row.groupId),programId:String(row.programId),majorId:String(row.majorId),photoUrl:row.photoVersion?`/api/v1/students/${row.id}/photo?v=${row.photoVersion}`:''}))};
}
