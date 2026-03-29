import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Select, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { database } from '../../services/firebase/config';
import { ref, get, set, remove, update } from 'firebase/database';

const { Option } = Select;

// Hàm sinh id từ title
function generateMatchId(title) {
  return title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function Matches() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingMatch, setEditingMatch] = useState(null);

  useEffect(() => {
    fetchTeams();
    fetchMatches();
  }, []);

  const fetchTeams = async () => {
    try {
      const teamsRef = ref(database, 'teams');
      const snapshot = await get(teamsRef);
      if (snapshot.exists()) {
        const teamsData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setTeams(teamsData);
      } else {
        setTeams([]);
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách đội thi');
    }
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const matchesRef = ref(database, 'matches');
      const snapshot = await get(matchesRef);
      if (snapshot.exists()) {
        const matchesData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setMatches(matchesData);
      } else {
        setMatches([]);
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách trận đấu');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMatch(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMatch(record);
    form.setFieldsValue({
      title: record.title,
      id: record.id,
      description: record.description || '',
      status: record.status || 'chua_thi',
      team_ids: record.team_ids || []
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await remove(ref(database, `matches/${id}`));
      message.success('Xóa trận đấu thành công');
      fetchMatches();
    } catch (error) {
      message.error('Lỗi khi xóa trận đấu');
    }
  };

  const handleSubmit = async (values) => {
    try {
      let id;
      const matchPayload = {
        title: values.title,
        description: values.description || '',
        status: values.status,
        team_ids: values.team_ids
      };

      if (editingMatch) {
        id = editingMatch.id;
        await update(ref(database, `matches/${id}/`), matchPayload);
        message.success('Cập nhật trận đấu thành công');
      } else {
        id = generateMatchId(values.title);
        const newMatchData = {
          ...matchPayload,
          id,
        };
        await set(ref(database, `matches/${id}`), newMatchData);
        message.success('Thêm trận đấu thành công');
      }

      setModalVisible(false);
      fetchMatches();
    } catch (error) {
      console.error('Lỗi khi lưu trận đấu:', error);
      message.error(`Lỗi khi lưu trận đấu: ${error.message}`);
    }
  };

  const handleResetMatchState = (matchId) => {
    if (!matchId) {
      message.error('Không thể reset: ID trận đấu không hợp lệ.');
      return;
    }

    const matchNodeRef = ref(database, `matches/${matchId}`);
    const updatesToApply = {
      answers: null,
      scores: null,
      jigsaw_states: null,
      live_state: null,
      participation: null,
      ui_states: null,
      status: 'chua_thi',
    };

    update(matchNodeRef, updatesToApply)
      .then(() => {
        message.success('Trạng thái trận đấu đã được reset thành công');
        fetchMatches();
      })
      .catch((error) => {
        console.error(`Firebase update error for matchId: ${matchId}:`, error);
        message.error(`Lỗi khi reset trạng thái trận đấu: ${error.message}`);
      });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Tên trận đấu',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <span style={{ color: '#aaa' }}>Không có</span>
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        let label = 'Chưa thi';
        if (status === 'dang_thi') { color = 'processing'; label = 'Đang thi'; }
        if (status === 'da_thi') { color = 'success'; label = 'Đã thi'; }
        if (status === 'chua_thi') { color = 'default'; label = 'Chưa thi'; }
        return <Tag color={color}>{label}</Tag>;
      }
    },
    {
      title: 'Đội tham gia',
      dataIndex: 'team_ids',
      key: 'team_ids',
      render: (teamIds) => (
        <>
          {teamIds && teamIds.map((id) => {
            const team = teams.find((t) => t.id === id);
            return <Tag key={id}>{team ? team.name : id}</Tag>;
          })}
        </>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xóa trận đấu"
            description="Bạn có chắc muốn xóa trận đấu này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
            >
              Xóa
            </Button>
          </Popconfirm>
          <Button
            danger
            onClick={() => {
              if (record && record.id) {
                handleResetMatchState(record.id);
              } else {
                message.error('Không thể reset: Dữ liệu trận đấu không hợp lệ.');
              }
            }}
          >
            Reset
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          Thêm trận đấu
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={matches}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingMatch ? 'Sửa trận đấu' : 'Thêm trận đấu'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="Tên trận đấu"
            rules={[{ required: true, message: 'Vui lòng nhập tên trận đấu' }]}
          >
            <Input
              placeholder="Nhập tên trận đấu"
              disabled={!!editingMatch}
              onChange={(e) => {
                if (!editingMatch) {
                  const id = generateMatchId(e.target.value);
                  form.setFieldsValue({ id });
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="id"
            label="ID (tự sinh)"
          >
            <Input disabled placeholder="ID sẽ tự sinh từ tên trận đấu" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Mô tả"
          >
            <Input.TextArea placeholder="Nhập mô tả cho trận đấu (nếu có)" />
          </Form.Item>
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
            initialValue="chua_thi"
          >
            <Select>
              <Option value="chua_thi">Chưa thi</Option>
              <Option value="dang_thi">Đang thi</Option>
              <Option value="da_thi">Đã thi</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="team_ids"
            label="Chọn từ 4 đến 7 đội tham gia"
            rules={[
              { required: true, message: 'Vui lòng chọn từ 4 đến 7 đội' },
              {
                validator: (_, value) =>
                  value && value.length >= 4 && value.length <= 7
                    ? Promise.resolve()
                    : Promise.reject(new Error('Phải chọn từ 4 đến 7 đội'))
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Chọn từ 4 đến 7 đội"
              maxCount={7}
              maxTagCount={7}
              options={teams.map((team) => ({
                label: team.name,
                value: team.id
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingMatch ? 'Cập nhật' : 'Thêm'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Matches;
