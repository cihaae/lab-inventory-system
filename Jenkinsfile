pipeline {
  agent any

  environment {
    LABSTOCK_PORT = '8081'
  }

  stages {
    stage('1. Checkout Code') {
      steps {
        echo 'Checking out source code from repository...'
        checkout scm
      }
    }

    stage('2. Syntax Check') {
      steps {
        echo 'Memvalidasi sintaks backend Python...'
        bat 'docker run --rm -v "%cd%/backend":/src -w /src python:3.12-slim python -m py_compile app.py'
      }
    }

    stage('3. Build & Deploy') {
      steps {
        echo 'Deploying application via Docker Compose...'
        bat '''
          docker compose down || ver >nul
          docker compose up --build -d
        '''
      }
    }

    stage('4. Health Check') {
      steps {
        echo 'Menjalankan health check endpoint...'
        sleep 5
        bat 'docker compose ps'
        bat 'curl -fsS http://localhost:8081/api/inventory'
      }
    }
  }

  post {
    success {
      echo 'Pipeline LabStock berhasil dijalankan!'
    }
    failure {
      echo 'Pipeline LabStock gagal. Silakan periksa Console Output.'
    }
  }
}