SELECT
  tags->>'Name' AS "名前",
  instance_id AS "インスタンスID",
  instance_type AS "インスタンスタイプ",
  image_id AS "イメージID",
  private_dns_name AS "プライベートDNS",
  private_ip_address AS "プライベートIP",
  public_dns_name AS "パブリックDNS",
  public_ip_address AS "パブリックIP",
  vpc_id AS "VPC ID",
  subnet_id AS "サブネットID",
  placement_availability_zone AS "アベイラビリティゾーン",
  root_device_name AS "ルートデバイス名",
  key_name AS "キーペア",
  platform_details AS "プラットフォーム",
  architecture AS "アーキテクチャ"
FROM aws_ec2_instance
-- 終了したインスタンスは除外
WHERE NOT instance_state = 'terminated'
ORDER BY "名前";