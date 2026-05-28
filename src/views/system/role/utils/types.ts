// 虽然字段很少 但是抽离出来 后续有扩展字段需求就很方便了

interface FormItemProps {
  /** 角色ID（编辑时必填） */
  id?: string;
  /** 角色名称（表单字段） */
  name: string;
  /** 角色标识（表单字段） */
  code: string;
  /** 备注（表单字段） */
  remark: string;
  /** 后端字段 - 角色名称 */
  roleName?: string;
  /** 后端字段 - 角色编码 */
  roleCode?: string;
  /** 后端字段 - 角色描述 */
  description?: string;
}
interface FormProps {
  formInline: FormItemProps;
}

export type { FormItemProps, FormProps };
