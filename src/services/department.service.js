import { supabase } from '../lib/supabase.js'

/**
 * department.service — minimal reads for the departments table.
 *
 * The Employee Management page needs a list of departments to populate
 * its filter dropdown and the create/edit form's department picker. The
 * full CRUD will land later in its own dedicated department admin page.
 */

const DEPARTMENT_SELECT = `
  id,
  name,
  code,
  description,
  manager_id,
  created_at,
  updated_at
`

export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select(DEPARTMENT_SELECT)
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function getDepartmentById(id) {
  const { data, error } = await supabase
    .from('departments')
    .select(DEPARTMENT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
