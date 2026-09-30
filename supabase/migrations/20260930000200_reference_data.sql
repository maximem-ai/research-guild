-- Reference data: arXiv categories (all cs.* plus a starter set of other archives) and curated sub-topics.
-- Category names follow arXiv's public category taxonomy (https://arxiv.org/category_taxonomy).

insert into categories (code, archive, name) values
  ('cs.AI','cs','Artificial Intelligence'),
  ('cs.AR','cs','Hardware Architecture'),
  ('cs.CC','cs','Computational Complexity'),
  ('cs.CE','cs','Computational Engineering, Finance, and Science'),
  ('cs.CG','cs','Computational Geometry'),
  ('cs.CL','cs','Computation and Language'),
  ('cs.CR','cs','Cryptography and Security'),
  ('cs.CV','cs','Computer Vision and Pattern Recognition'),
  ('cs.CY','cs','Computers and Society'),
  ('cs.DB','cs','Databases'),
  ('cs.DC','cs','Distributed, Parallel, and Cluster Computing'),
  ('cs.DL','cs','Digital Libraries'),
  ('cs.DM','cs','Discrete Mathematics'),
  ('cs.DS','cs','Data Structures and Algorithms'),
  ('cs.ET','cs','Emerging Technologies'),
  ('cs.FL','cs','Formal Languages and Automata Theory'),
  ('cs.GL','cs','General Literature'),
  ('cs.GR','cs','Graphics'),
  ('cs.GT','cs','Computer Science and Game Theory'),
  ('cs.HC','cs','Human-Computer Interaction'),
  ('cs.IR','cs','Information Retrieval'),
  ('cs.IT','cs','Information Theory'),
  ('cs.LG','cs','Machine Learning'),
  ('cs.LO','cs','Logic in Computer Science'),
  ('cs.MA','cs','Multiagent Systems'),
  ('cs.MM','cs','Multimedia'),
  ('cs.MS','cs','Mathematical Software'),
  ('cs.NA','cs','Numerical Analysis'),
  ('cs.NE','cs','Neural and Evolutionary Computing'),
  ('cs.NI','cs','Networking and Internet Architecture'),
  ('cs.OH','cs','Other Computer Science'),
  ('cs.OS','cs','Operating Systems'),
  ('cs.PF','cs','Performance'),
  ('cs.PL','cs','Programming Languages'),
  ('cs.RO','cs','Robotics'),
  ('cs.SC','cs','Symbolic Computation'),
  ('cs.SD','cs','Sound'),
  ('cs.SE','cs','Software Engineering'),
  ('cs.SI','cs','Social and Information Networks'),
  ('cs.SY','cs','Systems and Control'),
  ('stat.ML','stat','Machine Learning (Statistics)'),
  ('stat.ME','stat','Methodology'),
  ('stat.AP','stat','Applications'),
  ('math.OC','math','Optimization and Control'),
  ('math.PR','math','Probability'),
  ('math.ST','math','Statistics Theory'),
  ('eess.AS','eess','Audio and Speech Processing'),
  ('eess.IV','eess','Image and Video Processing'),
  ('eess.SP','eess','Signal Processing'),
  ('eess.SY','eess','Systems and Control'),
  ('q-bio.QM','q-bio','Quantitative Methods'),
  ('q-bio.NC','q-bio','Neurons and Cognition'),
  ('econ.EM','econ','Econometrics'),
  ('econ.GN','econ','General Economics'),
  ('physics.soc-ph','physics','Physics and Society'),
  ('physics.comp-ph','physics','Computational Physics'),
  ('quant-ph','quant-ph','Quantum Physics');

create or replace function pg_temp.seed_topics(p_cat text, p_topics text[]) returns void language plpgsql as $$
declare t text;
begin
  foreach t in array p_topics loop
    insert into topics (category_code, slug, name)
    values (p_cat, trim(both '-' from regexp_replace(lower(t), '[^a-z0-9]+', '-', 'g')), t);
  end loop;
end $$;

select pg_temp.seed_topics('cs.AI', array['Agents & planning','Knowledge representation','Reasoning','Multi-agent systems',
  'AI safety & alignment','LLM evaluation','Search & constraint satisfaction','Explainability','AI for science','Robotics & embodied AI']);
select pg_temp.seed_topics('cs.LG', array['Deep learning theory','Optimization','Reinforcement learning','Generative models',
  'Representation learning','Graph neural networks','Federated & privacy-preserving learning','Fairness & robustness',
  'Time series','Efficient ML & compression']);
select pg_temp.seed_topics('cs.CL', array['Large language models','Machine translation','Information extraction',
  'Question answering','Dialogue systems','Multilingual & low-resource NLP','Summarization','Speech & spoken language',
  'Evaluation & benchmarks','Computational linguistics']);
select pg_temp.seed_topics('cs.CV', array['Image classification','Object detection & segmentation','3D vision',
  'Video understanding','Generative vision models','Vision-language models','Medical imaging','Self-supervised visual learning',
  'Remote sensing','Face & human analysis']);
select pg_temp.seed_topics('cs.CY', array['AI ethics & policy','Education technology','Digital divide & access',
  'Privacy & society','Misinformation','Labor & automation','Algorithmic accountability','Technology in the Global South']);
select pg_temp.seed_topics('cs.HC', array['User studies','Accessibility','Human-AI interaction','Visualization',
  'Social computing','Interaction techniques','CSCW','Design research']);
select pg_temp.seed_topics('cs.IR', array['Retrieval models','Recommender systems','Retrieval-augmented generation',
  'Search evaluation','Query understanding','Learning to rank','Conversational search']);
select pg_temp.seed_topics('cs.RO', array['Motion planning','Manipulation','Localization & mapping','Robot learning',
  'Human-robot interaction','Legged & aerial robots','Autonomous driving']);
select pg_temp.seed_topics('cs.SE', array['Program analysis','Software testing','AI for code','Empirical software engineering',
  'Requirements engineering','DevOps & reliability','Formal verification in practice']);
select pg_temp.seed_topics('cs.CR', array['Applied cryptography','Network security','ML security & adversarial attacks',
  'Privacy engineering','Malware analysis','Blockchain & smart contracts','Systems & software security']);
