select
  i.instance_id as "インスタンスID",
  i.tags ->> 'Name' as "インスタンス名",
  sg ->> 'GroupId' as "セキュリティグループID",
  sg ->> 'GroupName' as "セキュリティグループ名",
  sgr.type as "IN/OUT",
  sgr.ip_protocol as "プロトコル",
  sgr.from_port as "許可ポート",
  sgr.cidr_ipv4 as "ソース",
  sgr.description as "説明"
from
  aws_ec2_instance as i
  -- インスタンスが持つセキュリティグループのJSON配列を複数行に展開
  cross join jsonb_array_elements(i.security_groups) as sg
  -- セキュリティグループIDをキーにルールと結合
  inner join aws_vpc_security_group_rule as sgr
    on sg ->> 'GroupId' = sgr.group_id
order by
  i.instance_id,
  sgr.type,
  sgr.from_port;