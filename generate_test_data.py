import sqlite3
import random
import datetime
import os

def get_db_connection():
    """建立数据库连接"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    return conn

def create_event(conn, title, description, created_at, due_at, status="active", priority="medium"):
    """创建单个事件"""
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO events (title, description, created_at, due_at, status, priority)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (title, description, created_at, due_at, status, priority)
        )
        conn.commit()
        print(f"✓ 已创建事件: {title}")
        return cursor.lastrowid
    except Exception as e:
        print(f"✗ 创建事件 '{title}' 失败: {e}")
        conn.rollback()
        return None

def generate_test_data(num_events=20):
    """生成测试数据"""
    # 确保数据库文件存在
    db_exists = os.path.exists('events.db')
    if not db_exists:
        print("错误: events.db 文件不存在，请先运行应用程序初始化数据库")
        return
    
    # 连接数据库
    conn = get_db_connection()
    
    # 事件标题模板
    title_templates = [
        "完成项目报告", "参加团队会议", "回复重要邮件", "准备演示文稿", "代码审查",
        "学习新技术", "整理文档", "健身锻炼", "阅读专业书籍", "购买办公用品",
        "制定下周计划", "更新简历", "联系客户", "解决bug", "优化性能",
        "准备面试", "清理邮箱", "参加培训", "总结工作成果", "规划新项目",
        "更新系统文档", "参与产品讨论", "编写用户手册", "维护服务器", "设计数据库"
    ]
    
    # 事件描述模板
    description_templates = [
        "这是一个重要的任务，需要认真完成。",
        "与团队成员协作完成此项工作。",
        "确保在截止日期前提交成果。",
        "需要详细记录工作过程。",
        "可能需要加班完成。",
        "这个任务需要仔细规划时间。",
        "记得与相关人员沟通进展。",
        "需要准备详细的执行方案。"
    ]
    
    # 优先级列表（1=高，2=中，3=低）
    priorities = [1, 1, 2, 2, 2, 3, 3]  # 调整优先级分布，中等优先级稍多
    
    # 固定状态为active（未完成）
    status = "active"
    
    current_time = datetime.datetime.now()
    print(f"开始生成 {num_events} 个测试事件...")
    print(f"当前时间: {current_time}")
    print("-" * 50)
    
    created_count = 0
    
    # 使用循环生成事件
    for i in range(num_events):
        # 随机选择标题和描述
        title = random.choice(title_templates)
        # 为了避免重复，添加序号
        if random.random() > 0.3:  # 增加添加序号的概率，减少重复
            title = f"{title} #{i+1}"
        
        description = random.choice(description_templates)
        
        # 生成创建时间（过去60天内的随机时间，但不超过当前时间）
        days_before_created = random.randint(0, 60)  # 允许今天到过去60天内创建
        created_at = current_time - datetime.timedelta(days=days_before_created, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        
        # 生成多样化的截止日期（短期、中期、长期）
        # 30%短期：1-3天
        # 40%中期：4-14天
        # 20%长期：15-90天
        # 10%过期：已超过截止日期
        deadline_type = random.random()
        
        if deadline_type < 0.3:  # 短期
            days_after_current = random.randint(1, 3)
            due_at = current_time + datetime.timedelta(days=days_after_current, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        elif deadline_type < 0.7:  # 中期
            days_after_current = random.randint(4, 14)
            due_at = current_time + datetime.timedelta(days=days_after_current, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        elif deadline_type < 0.9:  # 长期
            days_after_current = random.randint(15, 90)
            due_at = current_time + datetime.timedelta(days=days_after_current, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        else:  # 过期事件
            days_before_due = random.randint(1, 30)
            due_at = current_time - datetime.timedelta(days=days_before_due, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        
        # 确保创建时间在截止时间之前
        if created_at > due_at:
            created_at = due_at - datetime.timedelta(hours=random.randint(1, 24))
        
        # 随机选择优先级
        priority = random.choice(priorities)
        
        # 转换为ISO格式字符串
        created_at_str = created_at.isoformat()
        due_at_str = due_at.isoformat()
        
        # 创建事件
        event_id = create_event(conn, title, description, created_at_str, due_at_str, status, priority)
        if event_id:
            created_count += 1
    
    conn.close()
    print("-" * 50)
    print(f"测试数据生成完成！成功创建 {created_count}/{num_events} 个事件。")

if __name__ == "__main__":
    print("备忘录系统测试数据生成工具")
    print("=" * 40)
    # 生成20条未完成的事件，包含多样化的截止日期
    generate_test_data(20)
