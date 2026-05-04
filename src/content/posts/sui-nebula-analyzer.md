---
title: "A Sui Chain TX Analyzer Based on NebulaGraph"
published: 2025-06-29
updated: 2025-07-01
description: How Sui-Nebula-Analyzer uses NebulaGraph to model on-chain wallet relationships and power relationship queries, statistics, and visualization.
image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/uxjw8haye2gr4mymjukn.png"
tags: [GraphQL, NebulaGraph, Web3, Blockchain]
category: Projects
draft: false
lang: en
---

Original post: [DEV Community](https://dev.to/coderserio/ji-yu-nebulagraph-de-sui-lian-shang-guan-xi-fen-xi-qi-5522)

Project Code: [GitHub - CoderSerio/Sui-Nebula-Analyzer](https://github.com/CoderSerio/Sui-Nebula-Analyzer)

## I. Project Background and Challenges

As blockchain technology advances, on-chain data is exploding. Extracting valuable insights from this deluge and uncovering complex relationships is crucial for ensuring transaction compliance.

Yet, raw blockchain data is often fragmented and unstructured, making analysis difficult. Blockchains like Sui, with their object-based model, differ from traditional account-based ones, posing new data analysis challenges.

In blockchain relationship analysis, traditional relational databases have many limitations:

- **Poor performance for multi-hop queries**: In complex transaction networks, multi-hop queries are needed. But SQL's JOIN operations struggle with large-scale, multi-level networks, failing to meet real-time analysis needs.
- **Difficulty modeling dynamic relationships**: Relationships between wallet addresses on the blockchain change dynamically. Traditional relational databases can't easily model and adapt to these ever-changing relationships.
- **Limited graph algorithm support**: Detecting abnormal on-chain behaviors, identifying money laundering patterns, or conducting community analyses requires graph algorithms like PageRank and community detection. Traditional databases lack native graph computing capabilities, requiring data export to specialized platforms, increasing complexity and latency.

Graph databases, with their natural graph structure storage and query abilities, efficiently handle complex relationship data and natively support various graph algorithms, making them ideal for blockchain data analysis.

So, I built a transaction relationship analysis platform using the NebulaGraph database to provide a solution for these problems.

## II. Why Choose NebulaGraph?

NebulaGraph is a high-performance, distributed graph database whose design philosophy aligns with blockchain data analysis requirements. It can:

- **Complex relationship queries**: It natively supports multi-hop queries, path analysis, and cycle detection via its graph query language (nGQL), enabling the discovery of deep relationships within vast on-chain data.
- **High-performance graph computing**: It has built-in or easily integrable graph algorithms like PageRank, community detection, and centrality, providing robust support for advanced analysis.
- **Real-time analysis**: It can respond to complex relationship queries in sub-seconds, meeting the real-time analysis demands of blockchain data.
- **Flexible modeling**: The graph model naturally adapts to the dynamic nature of blockchain data, making it easy to model and extend entities like wallets, transactions, and objects, as well as their complex relationships.

## III. System Architecture and Data Model

### 3.1 Overview of the Architecture

The project's backend services consist of two layers: Next.js Server and Gateway Server:

![Sui analysis platform program structure](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8lgjad75quhitwg0y6jd.png)

- **Frontend Application (Next.js Application)**: The user interface responsible for data visualization and user interaction.
- **API Layer (Next.js API Routes)**: Provides application-specific API interfaces, handles business logic, and coordinates with the Gateway Server for database operations. For instance, `/api/execute` for query execution, `/api/data-collection` for blockchain data ingestion, and `/api/debug-db` for database debugging.
- **Gateway Server (Express App)**: Since Nebula's HTTP API is provided by Nebula Gateway, and the `Nebula Gateway SDK` is not very compatible with Next.js Server, a pure Node.js service is used here to connect and access Nebula Gateway.
- **NebulaGraph Database**: Stores and manages Sui on-chain data, offering high-performance graph query and computing capabilities.

### 3.2 Data Collection and Processing

![NebulaGraph data collection](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/e23hxs73i2ya1fna417e.png)

Sui-Nebula-Analyzer enables automated on-chain data collection, transforming raw Sui blockchain data into structured data suitable for storage in a graph database. The collection process involves obtaining transactions, events, and object information from the Sui chain and mapping them to vertices and edges in NebulaGraph.

### 3.3 NebulaGraph Data Model

To efficiently store and query Sui on-chain data, the project has designed specific graph spaces, tags, and edge types in NebulaGraph.

**Graph Space Management:**

```sql
DROP SPACE IF EXISTS sui_analysis;
CREATE SPACE IF NOT EXISTS sui_analysis (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(64));
```

**Tag Definitions:**

The `wallet` tag represents wallet addresses on the Sui chain, with the following properties:

```sql
CREATE TAG IF NOT EXISTS wallet (
  address string NOT NULL,
  first_seen datetime,
  last_seen datetime,
  transaction_count int DEFAULT 0,
  total_amount double DEFAULT 0.0,
  is_contract bool DEFAULT false,
  sui_balance double DEFAULT 0.0,
  owned_objects_count int DEFAULT 0,
  last_activity datetime
);
```

**Edge Type Definitions:**

The `transaction` edge type represents transactions between wallets, with the following properties:

```sql
CREATE EDGE IF NOT EXISTS transaction (
  amount double NOT NULL,
  tx_timestamp datetime NOT NULL,
  tx_hash string NOT NULL,
  gas_used int DEFAULT 0,
  success bool DEFAULT true,
  transaction_type string DEFAULT 'unknown'
);
```

The `related_to` edge type represents relationships between wallets, which are derived from analysis algorithms, with the following properties:

```sql
CREATE EDGE IF NOT EXISTS related_to (
  relationship_score double NOT NULL,
  common_transactions int DEFAULT 0,
  total_amount double DEFAULT 0.0,
  first_interaction datetime,
  last_interaction datetime,
  relationship_type string DEFAULT "unknown",
  avg_gas_used double DEFAULT 0.0
);
```

This data model design fully utilizes NebulaGraph's graph capabilities, enabling efficient storage and querying of complex on-chain relationships and laying the foundation for in-depth analysis.

## IV. Core Features and Applications

Sui-Nebula-Analyzer extensively uses NebulaGraph's graph query capabilities across its functional modules. Below are practical application examples demonstrating efficient on-chain data analysis using nGQL.

### 4.1 Statistical Analysis

![Sui tx and wallet count](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/f1ag6cnqgerefm0ax8af.png)

The project provides queries for basic on-chain statistics, helping users quickly understand the overall picture of the Sui network:

- **Counting wallets:**

  ```sql
  USE sui_analysis;
  MATCH (n:wallet) RETURN count(n) as count;
  ```

- **Counting transactions:**

  ```sql
  USE sui_analysis;
  MATCH ()-[e:transaction]->() RETURN count(e) as count;
  ```

- **Counting relationships:**

  ```sql
  USE sui_analysis;
  MATCH ()-[r:related_to]->() RETURN count(r) as count;
  ```

### 4.2 Relationship Queries and Analysis

![Sui wallets' relationship analysis](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/yrp2qnmv0a04b3vo9k5z.png)

This is one of the core functions of Sui-Nebula-Analyzer. Through nGQL's powerful graph traversal and pattern matching capabilities, it uncovers complex relationships between wallets.

- **Basic mode: Querying relationships**

  This query retrieves precomputed relationships between wallets, usually based on the `related_to` edge type and its `relationship_score` attribute.

  ```sql
  USE sui_analysis;
  MATCH (a:wallet)-[r:related_to]-(b:wallet)
  WHERE r.relationship_score >= 0.1
  RETURN a.wallet.address AS addr1,
         b.wallet.address AS addr2,
         r.relationship_score AS score,
         r.common_transactions AS common_tx,
         r.total_amount AS amount
  LIMIT 50;
  ```

- **Pro mode: Querying enhanced fields**

  Building on the basic query, this returns more detailed relationship information, such as average Gas consumption, first and last interaction times, relationship types, and wallet balances and object counts.

  ```sql
  USE sui_analysis;
  MATCH (a:wallet)-[r:related_to]-(b:wallet)
  WHERE r.relationship_score >= 0.1
  RETURN a.wallet.address AS addr1,
         b.wallet.address AS addr2,
         r.relationship_score AS score,
         r.common_transactions AS common_tx,
         r.total_amount AS amount,
         r.avg_gas_used AS avg_gas,
         r.first_interaction AS first_interaction,
         r.last_interaction AS last_interaction,
         r.relationship_type AS rel_type,
         a.wallet.sui_balance AS addr1_balance,
         a.wallet.owned_objects_count AS addr1_objects,
         a.wallet.is_contract AS addr1_contract
  LIMIT 50;
  ```

- **Fallback query: Inferring relationships from transaction edges (when there are no precomputed relationships)**

  When there are no precomputed `related_to` edges, relationships between wallets can be inferred by directly querying `transaction` edges. This is very useful for real-time or more granular transaction analysis.

  ```sql
  USE sui_analysis;
  MATCH (a:wallet)-[r:transaction]-(b:wallet)
  RETURN a.wallet.address AS addr1,
         b.wallet.address AS addr2,
         r.amount AS amount,
         r.gas_used AS gas_used,
         r.success AS success,
         r.transaction_type AS tx_type,
         r.tx_timestamp AS tx_time,
         a.wallet.sui_balance AS addr1_balance,
         a.wallet.owned_objects_count AS addr1_objects,
         a.wallet.is_contract AS addr1_contract
  LIMIT 200;
  ```

### 4.3 Address Details and Related Account Queries

![Sui related addresses of wallets](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/0u77n2ivqrsxarclsyli.png)

The project allows users to query detailed information about a specific Sui wallet address and its directly related accounts, which is crucial for in-depth analysis of individual entity behavior patterns.

- **Querying target address basic information:**

  ```sql
  USE sui_analysis;
  MATCH (target:wallet)
  WHERE id(target) == "${searchAddress}"
  RETURN target.wallet.address AS address,
         target.wallet.transaction_count AS tx_count,
         target.wallet.total_amount AS total_amount,
         target.wallet.first_seen AS first_seen,
         target.wallet.last_seen AS last_seen;
  ```

- **Querying related accounts of the target address:**

  ```sql
  USE sui_analysis;
  MATCH (target:wallet)-[r:related_to]-(related:wallet)
  WHERE id(target) == "${searchAddress}"
  RETURN related.wallet.address AS address,
         r.relationship_score AS score,
         r.common_transactions AS common_tx,
         r.total_amount AS total_amount,
         r.first_interaction AS first_interaction,
         r.last_interaction AS last_interaction,
         r.relationship_type AS type
  LIMIT 20;
  ```

- **Fallback: Analyzing relationships from transaction edges**

  When analyzing relationships of a specific address from raw transaction data, this query can be used.

  ```sql
  USE sui_analysis;
  MATCH (target:wallet)-[r:transaction]-(related:wallet)
  WHERE id(target) == "${searchAddress}"
  RETURN related.wallet.address AS address,
         related.wallet.transaction_count AS tx_count,
         related.wallet.total_amount AS amount,
         r.amount AS tx_amount,
         r.tx_timestamp AS tx_time
  LIMIT 10;
  ```

### 4.4 Visualizing Network Connections

![Sui tx relationship visualization](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/sderrlwapmfhi9wkb27g.png)

To provide an intuitive transaction network view, the project supports querying center nodes and their relationships, offering data support for frontend visualization.

- **Querying center node information:**

  ```sql
  USE sui_analysis;
  MATCH (center:wallet)
  WHERE id(center) == "${searchAddress}"
  RETURN center.wallet.address AS center_address,
         center.wallet.transaction_count AS center_tx_count,
         center.wallet.total_amount AS center_amount;
  ```

- **Querying network relationships:**

  ```sql
  USE sui_analysis;
  MATCH (center:wallet)-[r:transaction]-(connected:wallet)
  WHERE id(center) == "${searchAddress}"
  RETURN connected.wallet.address AS connected_address,
         connected.wallet.transaction_count AS connected_tx_count,
         connected.wallet.total_amount AS connected_amount,
         r.amount AS edge_amount,
         r.tx_timestamp AS tx_time
  LIMIT 50;
  ```

## V. Summary

The Sui-Nebula-Analyzer project successfully combines Sui blockchain data with the NebulaGraph graph database to build an efficient and flexible on-chain relationship analysis platform demo.

Although it's just a demo project, the demonstrated engineering architecture is effective and showcases NebulaGraph's powerful functionality and scalability in such scenarios. In a production environment, more graph algorithms like community detection and influence analysis could be integrated on this basis to achieve more precise relationship analysis.
