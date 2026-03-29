import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Upload, message, Space, Tabs, Tag, App as AntdApp } from 'antd';
import { EditOutlined, DeleteOutlined, UploadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { database } from '../../services/firebase/config';
import { ref, get, set, remove, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import { uploadToCloudinary } from '../../utils/cloudinary';

const { Option } = Select;
const { TextArea } = Input;

function Questions() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [questionsData, setQuestionsData] = useState({});
  const [mediaUploading, setMediaUploading] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, pkg: '', qid: '', data: {} });
  const [editTopicModal, setEditTopicModal] = useState({ open: false, pkg: '', data: {} });
  const [form] = Form.useForm();
  const [topicForm] = Form.useForm();

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    if (selectedMatchId && selectedRound) {
      fetchQuestions();
    }
  }, [selectedMatchId, selectedRound, refresh]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
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

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const roundRef = ref(database, `matches/${selectedMatchId}/${selectedRound}`);
      const snapshot = await get(roundRef);
      if (snapshot.exists()) {
        setQuestionsData(snapshot.val());
      } else {
        setQuestionsData({});
      }
    } catch (error) {
      message.error('Lỗi khi tải câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý import Excel
  const handleExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const keyMap = {
        uestion_tex: 'question_text',
        media_typ: 'media_type',
        hint_image: 'hint_image_url',
        hint_image_url_: 'hint_image_url',
        hint_answer_: 'hint_answer',
        // Thêm các trường sai chính tả khác nếu có
      };
      const json = raw.map(row => {
        const fixed = {};
        for (const key in row) {
          const newKey = keyMap[key] || key;
          fixed[newKey] = row[key];
        }
        if (fixed.question && /^question_\d+$/.test(fixed.question)) {
          fixed.question_num = parseInt(fixed.question.split('_')[1], 10);
        }
        return fixed;
      });
      setExcelData(json);
      setPreviewVisible(true);
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // Lưu dữ liệu từ Excel vào DB
  const handleSaveExcel = async () => {
    if (!selectedMatchId || !selectedRound) {
      message.error('Chọn trận đấu và phần thi trước khi nhập!');
      return;
    }
    setLoading(true);
    try {
      const prepareMediaData = (mediaType, mediaUrl) => {
        if (!mediaUrl || mediaType === 'none' || !mediaType) {
          return null;
        }
        return { type: mediaType, url: mediaUrl };
      };

      if (selectedRound === 'round_1') {
        const data = {};
        excelData.forEach(row => {
          const pkg = row.package;
          if (!data[pkg]) data[pkg] = {};
          const qid = row.question || `question_${Object.keys(data[pkg]).length + 1}`;
          data[pkg][qid] = {
            question: row.question_text,
            answer: row.answer,
            question_num: row.question_num || null,
            media: prepareMediaData(row.media_type, row.media_url)
          };
        });
        await update(ref(database, `matches/${selectedMatchId}/round_1`), data);
      } else if (selectedRound === 'round_2') {
        const data = {};
        excelData.forEach((row, idx) => {
          const qid = row.question || `question_${idx + 1}`;
          data[qid] = {
            question: row.question_text,
            options: {
              A: row.option_A,
              B: row.option_B,
              C: row.option_C,
              D: row.option_D
            },
            answer: row.answer,
            question_num: row.question_num || null,
            media: prepareMediaData(row.media_type, row.media_url)
          };
        });
        await update(ref(database, `matches/${selectedMatchId}/round_2`), data);
      } else if (selectedRound === 'round_3') {
        // Đọc dữ liệu cũ để merge
        const round3Ref = ref(database, `matches/${selectedMatchId}/round_3`);
        const snapshot = await get(round3Ref);
        const oldData = snapshot.exists() ? snapshot.val() : {};

        const data = { ...oldData };
        excelData.forEach(row => {
          const pkg = row.package;
          if (!pkg) return;

          if (!data[pkg]) data[pkg] = {};

          if (data[pkg].hint_image_url === undefined) {
            data[pkg].hint_image_url = oldData[pkg]?.hint_image_url || '';
          }
          if (data[pkg].hint_answer === undefined) {
            data[pkg].hint_answer = oldData[pkg]?.hint_answer || '';
          }

          if (row.hint_image_url) {
            data[pkg].hint_image_url = row.hint_image_url;
          }
          if (row.hint_answer) {
            data[pkg].hint_answer = row.hint_answer;
          }

          const hasQuestionContent = row.question || row.question_text || row.answer || row.media_type || row.media_url;
          if (!hasQuestionContent) {
            return;
          }

          const qid = row.question || `question_${Object.keys(data[pkg]).filter(k => k.startsWith('question_')).length + 1}`;
          data[pkg][qid] = {
            question: row.question_text,
            answer: row.answer,
            question_num: row.question_num || null,
            media: prepareMediaData(row.media_type, row.media_url)
          };
        });
        await set(ref(database, `matches/${selectedMatchId}/round_3`), data);
      }
      message.success('Nhập câu hỏi thành công!');
      setPreviewVisible(false);
      setExcelData([]);
      setRefresh(r => !r);
    } catch (error) {
      message.error('Lỗi khi lưu câu hỏi!');
    }
    setLoading(false);
  };

  // Sửa câu hỏi
  const openEditModal = (pkg, qid, data) => {
    setEditModal({ 
      open: true, 
      pkg: pkg || '', // Đảm bảo pkg luôn là string
      qid: qid || '', 
      data: data || {} 
    });
    form.resetFields(); // Reset form trước khi set giá trị mới
    if (data) {
      form.setFieldsValue(data);
    }
  };
  const closeEditModal = () => {
    setEditModal({ open: false, pkg: '', qid: '', data: {} });
    form.resetFields();
  };

  // Sửa chủ đề (topic) phần 3
  const openEditTopicModal = (pkg, data) => setEditTopicModal({ open: true, pkg, data });
  const closeEditTopicModal = () => setEditTopicModal({ open: false, pkg: '', data: {} });

  // Lưu câu hỏi đã sửa
  const handleEditQuestion = async (pkg, qid, values) => {
    try {
      let path;
      if (selectedRound === 'round_1') {
        path = `matches/${selectedMatchId}/round_1/${pkg}/${qid || `question_${Date.now()}`}`;
      } else if (selectedRound === 'round_2') {
        path = `matches/${selectedMatchId}/round_2/${qid || `question_${Date.now()}`}`;
      } else if (selectedRound === 'round_3') {
        path = `matches/${selectedMatchId}/round_3/${pkg}/${qid || `question_${Date.now()}`}`;
      }
      
      let mediaData = values.media;
      if (mediaData && (mediaData.type === 'none' || !mediaData.url)) {
        mediaData = null;
      } else if (mediaData && !mediaData.type && !mediaData.url) { // Case where both type and url are empty initially
        mediaData = null;
      }

      const dataToSave = { ...values, media: mediaData };
      
      await set(ref(database, path), dataToSave);
      message.success(qid ? 'Cập nhật câu hỏi thành công' : 'Thêm câu hỏi thành công');
      setRefresh(r => !r);
      closeEditModal();
    } catch (error) {
      message.error('Lỗi khi cập nhật câu hỏi');
    }
  };

  // Lưu chủ đề đã sửa
  const handleEditTopicSubmit = async (values) => {
    await update(ref(database, `matches/${selectedMatchId}/round_3/${editTopicModal.pkg}`), values);
    message.success('Cập nhật chủ đề thành công');
    closeEditTopicModal();
    setRefresh(r => !r);
  };

  // Upload media cho câu hỏi
  const handleMediaUpload = async (file, form, field) => {
    setMediaUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      form.setFieldsValue({ media: { ...form.getFieldValue('media'), url } });
      message.success('Upload thành công!');
    } catch (e) {
      message.error('Upload thất bại');
    }
    setMediaUploading(false);
  };

  // Upload media cho chủ đề (hint_image_url hoặc hint_answer.media)
  const handleTopicMediaUpload = async (file, form, field) => {
    setMediaUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      form.setFieldsValue({ [field]: url });
      message.success('Upload thành công!');
    } catch (e) {
      message.error('Upload thất bại');
    }
    setMediaUploading(false);
  };

  // Hiển thị bảng preview Excel
  const renderExcelPreviewTable = () => {
    if (!excelData.length) return null;
    const columns = Object.keys(excelData[0]).map(key => ({
      title: key,
      dataIndex: key,
      key
    }));
    return (
      <Table
        columns={columns}
        dataSource={[...excelData].sort((a, b) => (a.question_num || 0) - (b.question_num || 0))}
        rowKey={(_, idx) => idx}
        pagination={false}
        size="small"
        style={{ marginTop: 16 }}
      />
    );
  };

  // Modal sửa câu hỏi
  const renderEditModal = () => {
    if (!editModal.open) return null;
    const isMC = selectedRound === 'round_2';
    
    return (
      <Modal 
        open={editModal.open} 
        title="Sửa câu hỏi" 
        onCancel={closeEditModal} 
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editModal.data}
          onFinish={values => handleEditQuestion(editModal.pkg, editModal.qid, values)}
        >
          <Form.Item name="question_num" label="Số thứ tự" rules={[{ required: true }]}>
            <Input type="number" min={1} />
          </Form.Item>
          
          <Form.Item name="question" label="Nội dung câu hỏi" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          {isMC ? (
            <>
              <Form.Item name={['options', 'A']} label="Đáp án A" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name={['options', 'B']} label="Đáp án B" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name={['options', 'C']} label="Đáp án C" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name={['options', 'D']} label="Đáp án D" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="answer" label="Đáp án đúng (A/B/C/D)" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="answer" label="Đáp án" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}

          <Form.Item name={['media', 'type']} label="Loại media">
            <Select allowClear placeholder="Chọn loại media hoặc để trống">
              <Option value="none">Không có media</Option>
              <Option value="image">Hình ảnh</Option>
              <Option value="youtube">YouTube</Option>
              <Option value="video">Video</Option>
              <Option value="audio">Audio</Option>
            </Select>
          </Form.Item>

          <Form.Item name={['media', 'url']} label="Media URL">
            <Input
              addonAfter={
                <Upload
                  showUploadList={false}
                  accept="image/*,video/*,audio/*"
                  beforeUpload={async file => {
                    setMediaUploading(true);
                    try {
                      const url = await uploadToCloudinary(file);
                      form.setFieldsValue({
                        media: {
                          ...form.getFieldValue('media'),
                          url
                        }
                      });
                      message.success('Upload thành công!');
                    } catch (e) {
                      message.error('Upload thất bại');
                    }
                    setMediaUploading(false);
                    return false;
                  }}
                >
                  <CloudUploadOutlined style={{ cursor: 'pointer' }} />
                </Upload>
              }
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={mediaUploading}>
            Cập nhật
          </Button>
        </Form>
      </Modal>
    );
  };

  // Modal sửa chủ đề round 3
  const renderEditTopicModal = () => {
    if (!editTopicModal.open) return null;
    return (
      <Modal
        open={editTopicModal.open}
        title="Sửa thông tin mật ảnh"
        onCancel={closeEditTopicModal}
        footer={null}
      >
        <Form
          form={topicForm}
          layout="vertical"
          initialValues={editTopicModal.data}
          onFinish={handleEditTopicSubmit}
        >
          <Form.Item name="hint_image_url" label="Ảnh gợi ý (URL)">
            <Input
              addonAfter={
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={async file => {
                    setMediaUploading(true);
                    try {
                      const url = await uploadToCloudinary(file);
                      topicForm.setFieldsValue({ hint_image_url: url });
                      message.success('Upload thành công!');
                    } catch (e) {
                      message.error('Upload thất bại');
                    }
                    setMediaUploading(false);
                    return false;
                  }}
                >
                  <CloudUploadOutlined style={{ cursor: 'pointer' }} />
                </Upload>
              }
            />
          </Form.Item>
          <Form.Item name="hint_answer" label="Đáp án mật ảnh">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={mediaUploading}>Cập nhật</Button>
        </Form>
      </Modal>
    );
  };

  return (
    <AntdApp>
      <div>
        {renderEditModal()}
        {renderEditTopicModal()}
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ minWidth: 200 }}
            placeholder="Chọn trận đấu"
            value={selectedMatchId}
            onChange={v => { setSelectedMatchId(v); setQuestionsData({}); }}
          >
            {matches.map(m => (
              <Option key={m.id} value={m.id}>{m.title}</Option>
            ))}
          </Select>
          <Select
            style={{ minWidth: 250 }}
            placeholder="Chọn phần thi"
            value={selectedRound}
            onChange={v => { setSelectedRound(v); setQuestionsData({}); }}
          >
            <Option value="round_1">Phần 1: Tiên phong</Option>
            <Option value="round_2">Phần 2: Khát vọng</Option>
            <Option value="round_3">Phần 3: Tự hào tiến bước</Option>
          </Select>
          {selectedMatchId && selectedRound && (
            <Upload
              beforeUpload={handleExcelUpload}
              showUploadList={false}
              accept=".xlsx,.xls"
            >
              <Button icon={<UploadOutlined />}>Nhập Excel</Button>
            </Upload>
          )}
        </Space>

        <Modal
          open={previewVisible}
          title="Xem trước dữ liệu nhập"
          onCancel={() => setPreviewVisible(false)}
          onOk={handleSaveExcel}
          okText="Lưu vào hệ thống"
          confirmLoading={loading}
          width={900}
        >
          {renderExcelPreviewTable()}
        </Modal>

        {selectedMatchId && selectedRound === 'round_1' && (
          <Tabs>
            {Object.entries(questionsData || {}).map(([pkg, questions]) => (
              <Tabs.TabPane
                tab={<span><Tag color="blue">{pkg}</Tag></span>}
                key={pkg}
              >
                <Table
                  dataSource={Object.entries(questions)
                    .map(([qid, q]) => ({ ...q, qid }))
                    .sort((a, b) => (a.question_num || 0) - (b.question_num || 0))}
                  columns={[
                    { title: 'Số thứ tự', dataIndex: 'question_num' },
                    { title: 'Câu hỏi', dataIndex: 'question' },
                    { title: 'Đáp án', dataIndex: 'answer' },
                    { title: 'Media', dataIndex: ['media', 'url'], render: url => url ? <a href={url} target="_blank" rel="noopener noreferrer">Xem</a> : '' },
                    {
                      title: 'Thao tác',
                      render: (_, record) => (
                        <Space>
                          <Button
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(pkg, record.qid, record)}
                          >Sửa</Button>
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={async () => {
                              await remove(ref(database, `matches/${selectedMatchId}/round_1/${pkg}/${record.qid}`));
                              setRefresh(r => !r);
                            }}
                          >Xóa</Button>
                        </Space>
                      )
                    }
                  ]}
                  rowKey="qid"
                  pagination={false}
                />
              </Tabs.TabPane>
            ))}
          </Tabs>
        )}

        {selectedMatchId && selectedRound === 'round_2' && (
          <Table
            dataSource={Object.entries(questionsData || {})
              .map(([qid, q]) => ({ ...q, qid }))
              .sort((a, b) => (a.question_num || 0) - (b.question_num || 0))}
            columns={[
              { title: 'Số thứ tự', dataIndex: 'question_num' },
              { title: 'Câu hỏi', dataIndex: 'question' },
              { title: 'A', dataIndex: ['options', 'A'] },
              { title: 'B', dataIndex: ['options', 'B'] },
              { title: 'C', dataIndex: ['options', 'C'] },
              { title: 'D', dataIndex: ['options', 'D'] },
              { title: 'Đáp án', dataIndex: 'answer' },
              { title: 'Media', dataIndex: ['media', 'url'], render: url => url ? <a href={url} target="_blank" rel="noopener noreferrer">Xem</a> : '' },
              {
                title: 'Thao tác',
                render: (_, record) => (
                  <Space>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(null, record.qid, record)}
                    >Sửa</Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={async () => {
                        await remove(ref(database, `matches/${selectedMatchId}/round_2/${record.qid}`));
                        setRefresh(r => !r);
                      }}
                    >Xóa</Button>
                  </Space>
                )
              }
            ]}
            rowKey="qid"
          />
        )}

        {selectedMatchId && selectedRound === 'round_3' && (
          <Tabs>
            {Object.entries(questionsData || {}).map(([pkg, topic]) => (
              <Tabs.TabPane
                tab={<span><Tag color="blue">{pkg}</Tag></span>}
                key={pkg}
              >
                <div>
                  <b>Ảnh gợi ý:</b> {topic.hint_image_url && <img src={topic.hint_image_url} alt="" style={{ maxWidth: 120, marginLeft: 8 }} />}
                </div>
                <div>
                  <b>Đáp án mật ảnh:</b> {topic.hint_answer}
                </div>
                <Button
                  type="primary"
                  style={{ margin: '8px 0' }}
                  onClick={() => openEditTopicModal(pkg, topic)}
                >
                  Sửa thông tin mật ảnh
                </Button>
                <Table
                  dataSource={Object.entries(topic)
                    .filter(([key]) => key.startsWith('question_'))
                    .map(([qid, q]) => ({ ...q, qid }))
                    .sort((a, b) => (a.question_num || 0) - (b.question_num || 0))}
                  columns={[
                    { title: 'Số thứ tự', dataIndex: 'question_num' },
                    { title: 'Câu hỏi', dataIndex: 'question' },
                    { title: 'Đáp án', dataIndex: 'answer' },
                    { title: 'Media', dataIndex: ['media', 'url'], render: url => url ? <a href={url} target="_blank" rel="noopener noreferrer">Xem</a> : '' },
                    {
                      title: 'Thao tác',
                      render: (_, record) => (
                        <Space>
                          <Button
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(pkg, record.qid, record)}
                          >Sửa</Button>
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={async () => {
                              await remove(ref(database, `matches/${selectedMatchId}/round_3/${pkg}/${record.qid}`));
                              setRefresh(r => !r);
                            }}
                          >Xóa</Button>
                        </Space>
                      )
                    }
                  ]}
                  rowKey="qid"
                  pagination={false}
                />
              </Tabs.TabPane>
            ))}
          </Tabs>
        )}
      </div>
    </AntdApp>
  );
}

export default Questions; 
