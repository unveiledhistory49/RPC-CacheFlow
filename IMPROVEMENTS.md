# Roadmap & Future Improvements: RPC CacheFlow 🚀

This document outlines the planned evolution of CacheFlow from a production-ready MVP to an enterprise-grade RPC infrastructure tool.

---

## **Phase 1: Advanced Load Balancing & Performance**

### **1.1 Latency-Based Routing**
*   **Goal:** Move beyond simple Round-Robin.
*   **Implementation:** Track the response time of each `checkHealth` call and successful proxy requests. Maintain a moving average of latency per upstream.
*   **Benefit:** Always routes users to the fastest available node, significantly improving dApp UX.

### **1.2 Request Coalescing (collapsing)**
*   **Goal:** Prevent "cache stampedes."
*   **Implementation:** If multiple identical requests for a cacheable method arrive simultaneously while a cache miss is already being processed, wait for the first request to finish and return that result to all pending callers.
*   **Benefit:** Reduces upstream load during traffic spikes for popular data (e.g., new token launches).

---

## **Phase 2: WebSocket Optimization**

### **2.1 Subscription Multiplexing**
*   **Goal:** Reduce cost of repetitive WebSocket subscriptions.
*   **Implementation:** 
    1. Intercept `subscribe` calls (e.g., `accountSubscribe`, `logsSubscribe`).
    2. Maintain a single upstream connection for each unique subscription parameter.
    3. Broadcast upstream messages to all connected clients interested in that subscription.
*   **Benefit:** Drastically reduces WebSocket "compute unit" (CU) usage on providers like Helius or Alchemy.

---

## **Phase 3: Observability & Management**

### **3.1 Admin Dashboard**
*   **Tech Stack:** Next.js + Tailwind + Tremor.
*   **Features:**
    *   Real-time Cache Hit/Miss ratio graphs.
    *   Visual status of Upstream Health.
    *   Usage statistics per API Key (Top consumers).
    *   Manual Cache Purging interface.

### **3.2 Enhanced Metrics**
*   **Metrics:** Track `compute_units_saved` based on standard provider pricing (e.g., 100 CU per `getAccountInfo`).
*   **Alerting:** Integration with Prometheus Alertmanager for Slack/Discord notifications when all upstreams are down.

---

## **Phase 4: Ecosystem & DevOps**

### **4.1 GitHub Actions CI/CD**
*   Automated test execution on every Pull Request.
*   Automated Docker image builds and pushes to GHCR/DockerHub on version tags.

### **4.2 Kubernetes Support**
*   Provide a official Helm Chart for high-availability deployments.
*   Implement Horizontal Pod Autoscaling (HPA) based on request volume.

---

## **How to Contribute**
1. Pick a task from the list.
2. Create a new branch `feature/your-feature-name`.
3. Implement the changes with corresponding tests.
4. Submit a Pull Request.
