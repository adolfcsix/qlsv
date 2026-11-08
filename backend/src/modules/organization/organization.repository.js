const joins = `
  FROM student_groups g
  JOIN curricula p ON p.curriculum_id=g.curriculum_id
  JOIN majors m ON m.major_id=p.major_id
  JOIN departments d ON d.department_id=m.department_id
  LEFT JOIN lecturers l ON l.lecturer_id=g.advisor_lecturer_id`;

function whereClause(query,user){
  const clauses=[],args=[];
  if(query.admissionYear){clauses.push('p.admission_year=?');args.push(query.admissionYear);}
  if(query.departmentId){clauses.push('d.department_id=?');args.push(query.departmentId);}
  if(query.majorId){clauses.push('m.major_id=?');args.push(query.majorId);}
  if(query.curriculumId){clauses.push('p.curriculum_id=?');args.push(query.curriculumId);}
  if (query.search) {
    const escape = value => value.replace(/[!%_]/g, '!$&');
    const field = query.driver === 'sqlite' ? 'QLSV_NORMALIZE(g.name)' : 'g.name';
    clauses.push(`(g.group_code LIKE ? ESCAPE '!' OR ${field} LIKE ? ESCAPE '!')`);
    args.push('%' + escape(query.search) + '%',
      '%' + escape(query.driver === 'sqlite' ? query.normalized : query.search) + '%');
  }
  if(user.role==='LECTURER'){
    clauses.push('l.user_id=?');args.push(user.user_id);
  }
  return {where:clauses.length?' WHERE '+clauses.join(' AND '):'',args};
}

export async function listStudentGroups(db,user,query){
  const {where,args}=whereClause({...query,driver:db.driver},user);
  const count=await db.get('SELECT COUNT(*) AS total'+joins+where,args);
  const rows=await db.all(`
    SELECT g.student_group_id AS id,g.group_code AS code,g.name,
      p.curriculum_id AS programId,p.name AS program,
      p.admission_year AS admissionYear,
      m.major_id AS majorId,m.name AS major,
      d.department_id AS departmentId,d.name AS department,
      l.full_name AS advisorName,l.lecturer_id AS advisor,
      COALESCE((SELECT gs.capacity FROM group_settings gs WHERE gs.student_group_id=g.student_group_id),50) AS capacity,
      (SELECT COUNT(*) FROM students s WHERE s.student_group_id=g.student_group_id) AS studentCount,
      (SELECT COUNT(*) FROM students s WHERE s.student_group_id=g.student_group_id AND s.status NOT IN ('withdrawn','graduated')) AS activeStudentCount
    ${joins}${where}
    ORDER BY p.admission_year DESC,g.group_code
    LIMIT ? OFFSET ?`,[...args,query.limit,query.offset]);
  return {total:Number(count.total),rows:rows.map(row=>({...row,id:String(row.id),programId:String(row.programId),majorId:String(row.majorId),departmentId:String(row.departmentId),advisor:row.advisor==null?'':String(row.advisor)}))};
}
