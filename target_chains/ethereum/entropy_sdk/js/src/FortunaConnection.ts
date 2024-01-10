import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

export class FortunaConnection {
  private httpClient: AxiosInstance;

  constructor(endpoint: string) {
    this.httpClient = axios.create({
      baseURL: endpoint,
      timeout: 5000,
      // timeout: config?.timeout || 5000,
    });
    axiosRetry(this.httpClient, {
      // retries: config?.httpRetries || 3,
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
    });
  }

  async retrieveRandomNumber(sequenceNumber: any) {
    const response = await this.httpClient.get(
      `/revelations/${sequenceNumber}`
    );
    return response.data.value.data;
  }
}
